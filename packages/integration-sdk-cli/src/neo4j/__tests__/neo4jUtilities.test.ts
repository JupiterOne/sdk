import { startsWithNumeric, sanitizePropertyName, sanitizeValue, buildPropertyParameters } from '../neo4jUtilities';


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
    const testSanitize: string = sanitizePropertyName(`1a!b@c#d$e%f^g&h*i(j)k-l=m+n\\o|p'q"r;s:t/u?v.w,x>y<z\`1~2\t3\n4[5]6{7}8 90`);
    expect(testSanitize).toEqual('n1a_b_c_d_e_f_g_h_i_j_k_l_m_n_o_p_q_r_s_t_u_v_w_x_y_z_1_2_3_4_5_6_7_8_90');
  });
  test('should sanitize value properly', () => {
    const testSanitize: string = sanitizeValue('1a!b@c#d$e%f^g&h*i(j)k-l=m+n\\o|p\'q"r;s:t/u?v.w,x>y<z`1~2\t3\n4[5]6{7}8 90');
    expect(testSanitize).toEqual('1a!b@c#d$e%f^g&h*i(j)k-l=m+n\\o|p\'q\\"r;s:t/u?v.w,x>y<z`1~2\t3\n4[5]6{7}8 90');
  });
  test('should build property string correctly including sanitization', () => {
    const testPropResults: Object = buildPropertyParameters({test: '123', '1sanitize1hi&$abc d': '1h"i&$abc d'});
    expect(testPropResults).toEqual({test:'123', n1sanitize1hi__abc_d:'1h\\"i&$abc d'});
  });
});