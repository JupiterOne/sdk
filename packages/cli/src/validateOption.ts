export function validateOption(options: {
  option: string;
  value: string | undefined;
  defaultEnvironmentVariable: string;
}) {
  const { option, value: passedValue, defaultEnvironmentVariable } = options;

  const value = passedValue ?? process.env[defaultEnvironmentVariable];

  if (!value) {
    throw new Error(
      `Missing option! Set the ${defaultEnvironmentVariable} environment variable or supply the ${option} option.`,
    );
  }

  return value;
}
