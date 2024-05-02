import { Static, TObject, TRef, Type } from '@sinclair/typebox';
import { StepEntityMetadata } from '../types';

interface CreateIntegrationHelpersOptions<
  IntegrationName extends string,
  SchemaKey extends string,
  ClassSchemaMap extends Record<SchemaKey, TObject>,
> {
  integrationName: IntegrationName;
  classSchemaMap: ClassSchemaMap;
}

export const createIntegrationHelpers = <
  IntegrationName extends string,
  SchemaKey extends string,
  ClassSchemaMap extends Record<SchemaKey, TObject>,
>({
  integrationName,
  classSchemaMap,
}: CreateIntegrationHelpersOptions<
  IntegrationName,
  SchemaKey,
  ClassSchemaMap
>) => {
  const createEntityType = <EntityName extends string>(
    entityName: EntityName,
  ) => `${integrationName}_${entityName}` as const;

  const createEntityMetadata = <
    ResourceName extends string,
    Class extends keyof ClassSchemaMap & string,
    EntityType extends string,
    Schema extends TObject,
  >({
    resourceName,
    _class,
    _type,
    description,
    schema,
    ...entityMetadata
  }: Omit<StepEntityMetadata, 'schema'> & {
    resourceName: ResourceName;
    _class: [Class, ...Class[]];
    _type: EntityType;
    description: string;
    schema: Schema;
  }) => {
    const classSchemaRefs = _class.map((className) =>
      Type.Ref(classSchemaMap[className]),
    ) as [TRef<ClassSchemaMap[Class]>, ...TRef<ClassSchemaMap[Class]>[]];

    const baseSchema = Type.Composite([
      Type.Object({
        _class: Type.Tuple(_class.map((className) => Type.Literal(className))),
        _type: Type.Literal(_type),
      }),
      schema,
    ]);

    const entitySchema = Type.Intersect([...classSchemaRefs, baseSchema], {
      $id: `#${_type}`,
      description: description,
    });
    type EntitySchemaType = Omit<Static<typeof entitySchema>, 'displayName'> & {
      displayName?: string | undefined;
    };

    const createEntityData = (
      entityData: Omit<EntitySchemaType, '_class' | '_type'>,
    ): EntitySchemaType => {
      return {
        ...entityData,
        _class: _class,
        _type: _type,
      } as EntitySchemaType;
    };

    const stepEntityMetadata = {
      _class,
      _type,
      resourceName,
      schema: Type.Strict(entitySchema),
      ...entityMetadata,
    } satisfies StepEntityMetadata;

    return [stepEntityMetadata, createEntityData] as const;
  };

  return { createEntityType, createEntityMetadata };
};
