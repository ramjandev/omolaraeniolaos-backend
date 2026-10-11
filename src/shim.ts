import 'reflect-metadata';

// Defensive shim for runtime environments (such as tsx / esbuild) where TypeScript decorator metadata is not emitted
const originalGetMetadata = (Reflect as any).getMetadata;
if (originalGetMetadata) {
  (Reflect as any).getMetadata = function (metadataKey: any, target: any, propertyKey?: any) {
    const result = originalGetMetadata.apply(this, arguments as any);
    if (metadataKey === 'design:paramtypes' && !result) {
      return [];
    }
    if (metadataKey === 'design:type' && !result) {
      return String;
    }
    return result;
  };
}

const originalDefineMetadata = (Reflect as any).defineMetadata;
if (originalDefineMetadata) {
  (Reflect as any).defineMetadata = function (
    metadataKey: any,
    metadataValue: any,
    target: any,
    propertyKey?: any,
  ) {
    if (
      metadataKey === 'swagger/apiModelProperties' &&
      metadataValue &&
      typeof metadataValue === 'object'
    ) {
      if (metadataValue.type === undefined) {
        metadataValue.type = String;
      }
    }
    return originalDefineMetadata.apply(this, arguments as any);
  };
}
