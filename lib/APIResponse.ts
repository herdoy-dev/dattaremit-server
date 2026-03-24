class APIResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  code?: string;

  constructor(success: boolean, message: string, data?: T, code?: string) {
    this.success = success;
    this.message = message;
    this.data = data;
    if (code) {
      this.code = code;
    }
  }
}

export default APIResponse;
