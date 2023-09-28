function generateRelationshipName(relationship) {
  const { from, to, _class } = relationship;
  return `${from.resourceName}_${_class}_${to.resourceName}`;
}

export { generateRelationshipName };
