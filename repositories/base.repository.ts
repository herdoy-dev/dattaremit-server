// Loosely typed delegate so we can accept Prisma's generated delegates
// without fighting their generic signatures. We only call known CRUD methods.
type PrismaDelegate<Model, Include = undefined> = {
  findMany: (args?: any) => Promise<Model[]>;
  findUnique: (args: any) => Promise<Model | null>;
  create: (args: any) => Promise<Model>;
  update: (args: any) => Promise<Model>;
  delete: (args: any) => Promise<Model>;
  deleteMany?: (args: any) => Promise<unknown>;
};

type FindManyOptions<Include> = {
  where?: any;
  orderBy?: any;
  include?: Include;
  take?: number;
  skip?: number;
};

/**
 * Lightweight helper to centralize Prisma CRUD calls with a default include.
 * This avoids duplicating the same `{ include: { ... } }` blocks across repositories.
 */
class PrismaRepository<Model, Include = undefined> {
  constructor(
    private readonly delegate: PrismaDelegate<Model, Include>,
    private readonly defaultInclude?: Include
  ) {}

  findMany(options: FindManyOptions<Include> = {}) {
    const { include, ...rest } = options;
    return this.delegate.findMany({
      include: include ?? this.defaultInclude,
      ...rest,
    });
  }

  findUnique(where: Record<string, unknown>, include?: Include) {
    return this.delegate.findUnique({
      where,
      include: include ?? this.defaultInclude,
    });
  }

  create(data: unknown, include?: Include) {
    return this.delegate.create({
      data,
      include: include ?? this.defaultInclude,
    });
  }

  update(where: Record<string, unknown>, data: unknown, include?: Include) {
    return this.delegate.update({
      where,
      data,
      include: include ?? this.defaultInclude,
    });
  }

  delete(where: Record<string, unknown>) {
    return this.delegate.delete({ where });
  }

  deleteMany(where: Record<string, unknown>) {
    if (!this.delegate.deleteMany) {
      throw new Error("deleteMany is not supported by this delegate");
    }
    return this.delegate.deleteMany({ where });
  }
}

export default PrismaRepository;

