export class CreateUserDto {
  email!: string;
  firstName!: string;
  lastName!: string;
  phone?: string;
  role?: 'employee' | 'manager';
  weeklyHours?: number;
}
