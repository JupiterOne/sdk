import { ensureNoArraysAreTooLargeToStore } from "../utils/ensureNoArraysAreTooLargeToStore"

describe('ensureNoArraysAreTooLargeToStore', () => {
    let warnSpy
    beforeEach(() => {
        warnSpy = jest.spyOn(global.console, 'warn')
    })
    afterEach(() => {
        warnSpy.mockRestore()
    });

    it('should error out if there is a property that is an array with more than 1,500 elements', () => {
        const properties = {
            array: new Array(1500).fill(Math.random())
        }
        expect(() => ensureNoArraysAreTooLargeToStore(properties)).toThrowErrorMatchingSnapshot()
    })
    it('should warn if there is a property that is an array with more than 1,000 elements, but less than 1,500 elements', () => {
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
    })
    it('should do nothing if an array has fewer than 1,000 elements', () => {
        const properties = {
            array: new Array(999).fill(Math.random())
        }
        ensureNoArraysAreTooLargeToStore(properties)
        expect(warnSpy).not.toHaveBeenCalled()
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
    })
})
