export class UpdateUserDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: 'employee' | 'manager';
  weeklyHours?: number;
}
