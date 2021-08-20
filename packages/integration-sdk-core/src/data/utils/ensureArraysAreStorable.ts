import { AdditionalEntityProperties, AdditionalRelationshipProperties } from "..";

export function ensureNoArraysAreTooLargeToStore(
    properties: AdditionalEntityProperties | AdditionalRelationshipProperties | undefined
  ): void | never {
    for (const [key, value] of Object.entries(properties ?? {})) {
        if(Array.isArray(value)) {
            if(value.length >= 1_500) {
                throw new Error(`Property ${key} is has too many array elements to be stored: ${value.length}`)
            } else if (value.length >= 1_000) {
                console.warn({key, length: value.length} ,`Property is close to having too many array elements to be stored`)
            }
        }
    }
  }