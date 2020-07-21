import { Entity } from "@jupiterone/integration-sdk-core";

export function createEntity({ type, id, optionalProps }: { type: string, id: string, optionalProps?: object }) {
  return {
    id: `entity-${id}`,
    name: `Entity ${id}`,
    displayName: `Entity ${id}`,
    createdOn: +`159183180889${id}`,
    _class: 'Entity',
    _type: `entity_type_${type}`,
    _key: `entity-${id}`,
    ...optionalProps
  } as Entity
}