import { Static, TObject, TRef, TSchema, Type } from '@sinclair/typebox';
import { GraphObjectSchema, StepEntityMetadata } from '../types';

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

  const createMultiClassEntityMetadata = <
    ClassSchema extends [TSchema, ...TSchema[]],
    EntitySchema extends TSchema,
  >({
    resourceName,
    _class,
    _type,
    description,
    schema,
    ...entityMetadata
  }: Omit<StepEntityMetadata, 'schema' | '_class'> & {
    resourceName: string;
    _class: ClassSchema;
    _type: string;
    description: string;
    schema: EntitySchema;
  }) => {
    const classRefs = _class.map((c) => Type.Ref(c)) as [
      TRef<TSchema>,
      ...TRef<TSchema>[],
    ];
    const requiredProps = Type.Object({
      _class: Type.Tuple(
        _class.map((classSchema) =>
          Type.Literal(classSchema.$id!.replace('#', '')),
        ),
      ),
      _type: Type.Literal(_type),
    });

    const jsonSchemaParts = [...classRefs, requiredProps, schema];
    const schemaMetadata = { $id: `#${_type}`, description };

    const entitySchema = Type.Intersect([..._class, requiredProps, schema]);
    const jsonSchema = Type.Intersect(jsonSchemaParts, schemaMetadata);

    const createEntityData = (
      entityData: Omit<Static<typeof entitySchema>, '_class' | '_type'>,
    ) =>
      // @ts-expect-error to-inifity-and-beyond
      ({
        ...entityData,
        _class: _class.map((classSchema) => classSchema.$id!.replace('#', '')),
        _type,
      }) as unknown as Static<typeof entitySchema>;

    const stepEntityMetadata = {
      _class: _class.map((classSchema) => classSchema.$id!.replace('#', '')),
      _type,
      resourceName,
      schema: Type.Strict(jsonSchema) as GraphObjectSchema,
      ...entityMetadata,
    } satisfies StepEntityMetadata;

    return [stepEntityMetadata, createEntityData] as const;
  };

  const createEntityMetadata = <
    Class extends keyof ClassSchemaMap & string,
    ResourceName extends string,
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
    _class: [Class];
    _type: EntityType;
    description: string;
    schema: Schema;
  }) => {
    const classSchemaRefs = _class.map((className) =>
      Type.Ref(classSchemaMap[className]),
    ) as [TRef<ClassSchemaMap[Class]>];

    const baseSchema = Type.Intersect([
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

    type BaseSchemaType = Omit<Static<typeof baseSchema>, 'displayName'> & {
      displayName?: string | undefined;
    };

    const createEntityData = (
      entityData: Omit<EntitySchemaType, '_class' | '_type'> &
        Omit<BaseSchemaType, '_class' | '_type'>,
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

  return {
    createEntityType,
    createEntityMetadata,
    createMultiClassEntityMetadata,
  };
};
