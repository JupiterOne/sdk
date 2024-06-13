export function assertEntity(entity: object): asserts entity is {
  _type: string;
  _class: string | string[];
} {
  if (!('_type' in entity)) {
    throw {
      message: 'Entity does not contain a "_type" property',
      property: '_type',
      validation: 'required',
    };
  }
  if (!('_class' in entity)) {
    throw {
      message: 'Entity does not contain a "_type" property',
      property: '_class',
      validation: 'required',
    };
  }

  if (!(typeof entity._type === 'string')) {
    throw {
      message: 'Entity does not contain a "_type" property',
      property: '_type',
      validation: 'required',
    };
  }
  if (!(typeof entity._class === 'string' || entity._class instanceof Array)) {
    throw {
      message: 'Entity does not contain a "_type" property',
      property: '_class',
      validation: 'required',
    };
  }
}
