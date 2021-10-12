type OneToNine = 1|2|3|4|5|6|7|8|9;
type ZeroToNine = 0|OneToNine;
type YYYY = `19${ZeroToNine}${ZeroToNine}` | `20${ZeroToNine}${ZeroToNine}`;
type MM = `0${OneToNine}` | `1${0|1|2}`;
type DD = `${0}${OneToNine}` | `${1|2}${ZeroToNine}` | `3${0|1}`;

export type DateYMString = `${YYYY}-${MM}`;
export type DateYMDString = `${DateYMString}-${DD}`;
