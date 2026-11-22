// Better Auth requires `User.name`; it is always derived from firstName + lastName.
export const fullName = (firstName: string, lastName: string) => `${firstName} ${lastName}`;
