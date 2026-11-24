import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { fullName } from './identity.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, pageSize = 20, q?: string) {
    // Basic search and list logic
    return {
      page,
      pageSize,
      total: 0,
      data: [],
    };
  }

  async findOne(id: string) {
    return { id, email: 'demo@example.com', firstName: 'Demo', lastName: 'User', role: 'employee' };
  }

  async create(dto: CreateUserDto) {
    return {
      id: 'generated-uuid',
      ...dto,
      name: fullName(dto.firstName, dto.lastName),
      role: dto.role ?? 'employee',
      createdAt: new Date().toISOString(),
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    // Keep `name` (used by the Better Auth session) in sync with the identity fields.
    const identity =
      dto.firstName || dto.lastName
        ? await this.findOne(id).then((u) => ({
            name: fullName(dto.firstName ?? u.firstName, dto.lastName ?? u.lastName),
          }))
        : {};
    return {
      id,
      ...dto,
      ...identity,
      updatedAt: new Date().toISOString(),
    };
  }

  async remove(id: string) {
    // Soft delete & RGPD anonymization
    return {
      id,
      deletedAt: new Date().toISOString(),
      email: `anonymized_${id}@deleted.local`,
    };
  }
}
