import {
  startsWithNumeric,
  sanitizePropertyName,
  sanitizeValue,
  buildPropertyParameters,
  getFromType,
  getToType,
} from '../neo4jUtilities';
import {
  Relationship,
  RelationshipDirection,
} from '@jupiterone/integration-sdk-core';

describe('#neo4jUtilities', () => {
  test('should return true for string starting with a numeric', () => {
    const testNameResults: boolean = startsWithNumeric('1testname');
    expect(testNameResults).toEqual(true);
  });
  test('should return false for string not starting with a numeric', () => {
    const testTrailingNumeric: boolean = startsWithNumeric('another1testname');
    expect(testTrailingNumeric).toEqual(false);
  });
  test('should sanitize property name properly', () => {
    const testSanitize: string = sanitizePropertyName(
      `1a!b@c#d$e%f^g&h*i(j)k-l=m+n\\o|p'q"r;s:t/u?v.w,x>y<z\`1~2\t3\n4[5]6{7}8 90`,
    );
    expect(testSanitize).toEqual(
      'n1a_b_c_d_e_f_g_h_i_j_k_l_m_n_o_p_q_r_s_t_u_v_w_x_y_z_1_2_3_4_5_6_7_8_90',
    );
  });
  test('should sanitize value properly', () => {
    const testSanitize: string = sanitizeValue(
      '1a!b@c#d$e%f^g&h*i(j)k-l=m+n\\o|p\'q"r;s:t/u?v.w,x>y<z`1~2\t3\n4[5]6{7}8 90',
    );
    expect(testSanitize).toEqual(
      '1a!b@c#d$e%f^g&h*i(j)k-l=m+n\\o|p\'q\\"r;s:t/u?v.w,x>y<z`1~2\t3\n4[5]6{7}8 90',
    );
  });
  test('should sanitize multiple escapes properly', () => {
    const testSanitize: string = sanitizeValue(
      '1a!b@c#d$e%f^g&h*i(j)k-l=m+n\\o|p\'q\\\\\\\\\\"r;s:t/u?v.w,x>y<z`1~2\t3\n4[5]6{7}8 90',
    );
    expect(testSanitize).toEqual(
      '1a!b@c#d$e%f^g&h*i(j)k-l=m+n\\o|p\'q\\"r;s:t/u?v.w,x>y<z`1~2\t3\n4[5]6{7}8 90',
    );
  });
});

describe('#buildPropertyParameters', () => {
  test('should build property string correctly including sanitization', () => {
    expect(
      buildPropertyParameters({
        test: '123',
        '1sanitize1hi&$abc d': '1h"i&$abc d',
      }),
    ).toEqual({
      test: '123',
      n1sanitize1hi__abc_d: '1h\\"i&$abc d',
    });
  });

  test('should ignore properties with the value "undefined"', () => {
    expect(
      buildPropertyParameters({
        test: '123',
        ignore: undefined,
      }),
    ).toEqual({
      test: '123',
    });
  });

  test('should ignore properties with the value "null"', () => {
    expect(
      buildPropertyParameters({
        test: '123',
        ignore: null,
      }),
    ).toEqual({
      test: '123',
    });
  });

  test('should not ignore "false" property values', () => {
    expect(
      buildPropertyParameters({
        test: '123',
        include: false,
      }),
    ).toEqual({
      test: '123',
      include: false,
    });
  });
});

describe('#getFromAndToTypes', () => {
  const testRelationshipData: Relationship = {
    _fromEntityKey: 'testKey1',
    _fromType: 'testType1',
    _toEntityKey: 'testKey2',
    _toType: 'testType2',
    _type: 'testRelType',
    _key: 'relKey',
    _class: 'testRelationshipClass',
  };
  const testRelationshipNoTypeData: Relationship = {
    _fromEntityKey: 'testKey1',
    _toEntityKey: 'testKey2',
    _type: 'testRelType',
    _key: 'relKey',
    _class: 'testRelationshipClass',
  };
  const testMappedRelationship: Relationship = {
    _class: 'EXPLOITS',
    _mapping: {
      relationshipDirection: RelationshipDirection.FORWARD,
      sourceEntityKey: 'testEntityKey',
      targetEntity: {
        _type: 'testEntityType',
        _class: ['testEntityClass'],
        _key: 'testEntityKey',
        name: 'testEntityName',
        displayName: 'testEntityDisplayName',
        description: 'Test Entity Description',
        references: ['https://test.entity.html'],
      },
      targetFilterKeys: [['_type', '_key']],
      skipTargetCreation: false,
    },
    displayName: 'TESTRELATIONSHIP',
    _key: 'testRelationshipKey',
    _type: 'testRelationshipType',
  };

  test('should build fromType label', () => {
    expect(getFromType(testRelationshipData)).toEqual(':testType1');
  });

  test('should build toType label', () => {
    expect(getToType(testRelationshipData)).toEqual(':testType2');
  });

  test('should return empty fromType label', () => {
    expect(getFromType(testRelationshipNoTypeData)).toEqual('');
  });

  test('should return empty toType label', () => {
    expect(getToType(testRelationshipNoTypeData)).toEqual('');
  });

  test('should return empty fromType label for mapped relationship', () => {
    expect(getFromType(testMappedRelationship)).toEqual('');
  });

  test('should return correct toType label for mapped relationship', () => {
    expect(getToType(testMappedRelationship)).toEqual(':testEntityType');
  });
});
