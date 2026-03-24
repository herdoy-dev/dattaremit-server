import * as Sentry from "@sentry/node";
import logger from "../lib/logger";
import {
  googleValidationClient,
  googlePlacesClient,
} from "../lib/google-maps-client";
import { handleGoogleMapsError } from "../lib/google-maps-error";
import type {
  AddressComponents,
  AddressValidationResult,
  AutocompletePrediction,
  ValidateAddressBody,
} from "../schemas/google-maps.schema";

// Google API response types (subset of what we need)
interface GoogleValidationResponse {
  result: {
    verdict: {
      inputGranularity?: string;
      validationGranularity?: string;
      geocodeGranularity?: string;
      addressComplete?: boolean;
      hasUnconfirmedComponents?: boolean;
      hasInferredComponents?: boolean;
      hasReplacedComponents?: boolean;
    };
    address: {
      formattedAddress?: string;
      postalAddress?: {
        regionCode?: string;
        postalCode?: string;
        administrativeArea?: string;
        locality?: string;
        addressLines?: string[];
      };
      addressComponents?: Array<{
        componentName: { text: string; languageCode?: string };
        componentType: string;
        confirmationLevel: string;
        replaced?: boolean;
        inferred?: boolean;
      }>;
    };
    geocode?: {
      location?: { latitude: number; longitude: number };
      placeId?: string;
    };
  };
}

interface GoogleAutocompleteResponse {
  predictions: Array<{
    description: string;
    place_id: string;
    structured_formatting: {
      main_text: string;
      secondary_text: string;
    };
  }>;
  status: string;
  error_message?: string;
}

interface GooglePlaceDetailsResponse {
  result: {
    formatted_address?: string;
    address_components?: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
  };
  status: string;
  error_message?: string;
}

const VALID_GRANULARITIES = new Set(["PREMISE", "SUB_PREMISE"]);
const REVIEW_GRANULARITIES = new Set(["ROUTE", "OTHER"]);

class GoogleMapsService {
  async validateAddress(
    address: ValidateAddressBody
  ): Promise<AddressValidationResult> {
    return Sentry.startSpan(
      {
        name: "google-maps.validateAddress",
        op: "http.client",
        attributes: { country: address.country },
      },
      async () => {
        try {
          const addressLines = [address.addressLine1];
          if (address.addressLine2) {
            addressLines.push(address.addressLine2);
          }

          const response =
            await googleValidationClient.post<GoogleValidationResponse>(
              "/v1:validateAddress",
              {
                address: {
                  regionCode: address.country,
                  addressLines,
                  locality: address.city,
                  administrativeArea: address.state,
                  postalCode: address.postalCode,
                },
              }
            );

          const { verdict, address: validatedAddress } = response.data.result;

          const corrections = this.extractCorrections(
            validatedAddress.addressComponents,
            address
          );

          const validationStatus = this.mapVerdictToStatus(verdict);

          return {
            validationStatus,
            validationGranularity: verdict.validationGranularity,
            addressComplete: verdict.addressComplete,
            formattedAddress: validatedAddress.formattedAddress,
            corrections: corrections.length > 0 ? corrections : undefined,
          };
        } catch (error) {
          logger.warn("Google Address Validation API failed", {
            error:
              error instanceof Error ? error.message : "Unknown error",
          });
          Sentry.captureException(error, { level: "warning" });

          return { validationStatus: "UNAVAILABLE" };
        }
      }
    );
  }

  async getPlaceDetails(
    placeId: string,
    sessionToken?: string
  ): Promise<AddressComponents> {
    return Sentry.startSpan(
      {
        name: "google-maps.placeDetails",
        op: "http.client",
        attributes: { placeId },
      },
      async () => {
        try {
          const params: Record<string, string> = {
            place_id: placeId,
            fields: "address_components,formatted_address",
          };

          if (sessionToken) {
            params.sessiontoken = sessionToken;
          }

          const response =
            await googlePlacesClient.get<GooglePlaceDetailsResponse>(
              "/place/details/json",
              { params }
            );

          if (response.data.status !== "OK") {
            throw new Error(
              response.data.error_message ||
                `Places API returned status: ${response.data.status}`
            );
          }

          return this.parseAddressComponents(response.data.result);
        } catch (error) {
          handleGoogleMapsError(error, "Failed to fetch place details");
        }
      }
    );
  }

  async getAutocompleteSuggestions(
    input: string,
    country?: string,
    sessionToken?: string,
    city?: string,
    state?: string,
    types?: string
  ): Promise<AutocompletePrediction[]> {
    return Sentry.startSpan(
      {
        name: "google-maps.autocomplete",
        op: "http.client",
        attributes: { country: country || "any" },
      },
      async () => {
        try {
          // Append city/state context for more relevant suggestions
          let searchInput = input;
          if (city || state) {
            const context = [city, state].filter(Boolean).join(", ");
            searchInput = `${input}, ${context}`;
          }

          const params: Record<string, string> = {
            input: searchInput,
            types: types ?? "address",
          };

          if (country) {
            params.components = `country:${country.toLowerCase()}`;
          }

          if (sessionToken) {
            params.sessiontoken = sessionToken;
          }

          const response =
            await googlePlacesClient.get<GoogleAutocompleteResponse>(
              "/place/autocomplete/json",
              { params }
            );

          if (
            response.data.status !== "OK" &&
            response.data.status !== "ZERO_RESULTS"
          ) {
            throw new Error(
              response.data.error_message ||
                `Places API returned status: ${response.data.status}`
            );
          }

          return (response.data.predictions || []).map((p) => ({
            placeId: p.place_id,
            description: p.description,
            mainText: p.structured_formatting.main_text,
            secondaryText: p.structured_formatting.secondary_text,
          }));
        } catch (error) {
          handleGoogleMapsError(
            error,
            "Failed to fetch address suggestions"
          );
        }
      }
    );
  }

  private mapVerdictToStatus(
    verdict: GoogleValidationResponse["result"]["verdict"]
  ): AddressValidationResult["validationStatus"] {
    const granularity = verdict.validationGranularity || "";

    if (
      VALID_GRANULARITIES.has(granularity) &&
      verdict.addressComplete &&
      !verdict.hasUnconfirmedComponents &&
      !verdict.hasReplacedComponents
    ) {
      return "VALID";
    }

    if (
      REVIEW_GRANULARITIES.has(granularity) ||
      !verdict.addressComplete ||
      verdict.hasUnconfirmedComponents ||
      verdict.hasReplacedComponents
    ) {
      return "NEEDS_REVIEW";
    }

    return "INVALID";
  }

  private parseAddressComponents(
    result: GooglePlaceDetailsResponse["result"]
  ): AddressComponents {
    const components = result.address_components || [];

    const findComponent = (type: string): string => {
      const comp = components.find((c) => c.types.includes(type));
      return comp?.long_name || "";
    };

    const findShortComponent = (type: string): string => {
      const comp = components.find((c) => c.types.includes(type));
      return comp?.short_name || "";
    };

    const streetNumber = findComponent("street_number");
    const route = findComponent("route");
    const street = [streetNumber, route].filter(Boolean).join(" ");

    return {
      street,
      city:
        findComponent("locality") ||
        findComponent("sublocality_level_1") ||
        findComponent("administrative_area_level_2"),
      state: findComponent("administrative_area_level_1"),
      postalCode: findComponent("postal_code"),
      country: findShortComponent("country"),
      formattedAddress: result.formatted_address || "",
    };
  }

  private extractCorrections(
    components: GoogleValidationResponse["result"]["address"]["addressComponents"] | undefined,
    inputAddress: ValidateAddressBody
  ): Array<{ field: string; original: string; corrected: string }> {
    if (!components) return [];

    return components
      .filter(
        (c) =>
          c.confirmationLevel !== "CONFIRMED" ||
          c.replaced ||
          c.inferred
      )
      .map((c) => {
        let original = c.replaced ? "(replaced)" : "(inferred)";
        if (c.componentType === "postal_code" && inputAddress.postalCode) {
          original = inputAddress.postalCode;
        }
        return {
          field: c.componentType,
          original,
          corrected: c.componentName.text,
        };
      })
      .filter((c) => c.original !== c.corrected);
  }
}

export default new GoogleMapsService();
