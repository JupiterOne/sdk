import { ensureNoArraysAreTooLargeToStore } from "../utils/ensureArraysAreStorable"

describe('ensureNoArraysAreTooLargeToStore', () => {
    it('should error out if there is a property that is an array with more than 1,500 elements', () => {
        const properties = {
            array: new Array(1500).fill(Math.random())
        }
        expect(() => ensureNoArraysAreTooLargeToStore(properties)).toThrowErrorMatchingSnapshot()
    })
    it('should warn if there is a property that is an array with more than 1,000 elements, but less than 1,500 elements', () => {
        const warnSpy = jest.spyOn(global.console, 'warn')
        let properties = {
            array: new Array(1000).fill(Math.random())
        }
        ensureNoArraysAreTooLargeToStore(properties)
        expect(warnSpy).toHaveBeenCalled()

        warnSpy.mockReset()
        properties = {
            array: new Array(1499).fill(Math.random())
        }
        ensureNoArraysAreTooLargeToStore(properties)
        expect(warnSpy).toHaveBeenCalled()
        warnSpy.mockRestore()
    })
    it('should do nothing if an array has fewer than 1,000 elements', () => {
        const warnSpy = jest.spyOn(global.console, 'warn')
        const properties = {
            array: new Array(999).fill(Math.random())
        }
        ensureNoArraysAreTooLargeToStore(properties)
        expect(warnSpy).not.toHaveBeenCalled()
        warnSpy.mockRestore()
    })
    it('should do nothing for properties that are not arrays', () => {
        const warnSpy = jest.spyOn(global.console, 'warn')
        const properties = {
            string: 'string',
            number: 1,
            undefined: undefined,
            null: null
        }
        ensureNoArraysAreTooLargeToStore(properties)
        expect(warnSpy).not.toHaveBeenCalled()
        warnSpy.mockRestore()
    })
})

// export function ensureNoArraysAreTooLargeToStore(
//     properties: AdditionalEntityProperties | AdditionalRelationshipProperties | undefined
//   ): void | never {
//     for (const [key, value] of Object.entries(properties ?? {})) {
//         if(Array.isArray(value)) {
//             if(value.length > 1_500) {
//                 throw new Error(`Property ${key} is has too many array elements to be stored: ${value.length}`)
//             } else if (value.length > 1_000) {
//                 console.warn({key, length: value.length} ,`Property is close to having too many array elements to be stored`)
//             }
//         }
//     }
//   }