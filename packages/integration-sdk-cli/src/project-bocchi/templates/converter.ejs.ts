
<% for(const converter of input.converters) { %>
export function create<%- converter.entityNamePascalCase %>Entity(data: any) {
    return createIntegrationEntity({
        entityData: {
            source: data,
            assign: {
                _key: data.<%- converter.keyField %>,
                _type: Entities.<%- converter.entityNameUpperSnakeCase %>._type,
                _class: Entities.<%- converter.entityNameUpperSnakeCase %>._class,
                <%= Object.entries(converter.staticFields ?? {}).map(([key, value]) => {
                    return `${key}: ${value},`;
                }).join('\n') _%>
                <%- Object.entries(converter.fieldConverters ?? {}).map(([key, value]) => {
                    return `${key}: data.${value},`;
                }).join('\n') _%>
            },
        },
    });
}
<% } %>