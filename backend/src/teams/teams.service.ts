import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return { data: [] };
  }

  async findOne(id: string) {
    return { id, name: 'Opérations', description: 'Équipe Opérations', managerId: 'manager-uuid', members: [] };
  }

  async create(dto: CreateTeamDto) {
    return {
      id: 'team-uuid',
      ...dto,
      createdAt: new Date().toISOString(),
    };
  }

  async update(id: string, dto: UpdateTeamDto) {
    return {
      id,
      ...dto,
      updatedAt: new Date().toISOString(),
    };
  }

  async remove(id: string) {
    return { id, deleted: true };
  }

  async addMember(teamId: string, userId: string) {
    return { teamId, userId, joinedAt: new Date().toISOString() };
  }

  async removeMember(teamId: string, userId: string) {
    return { teamId, userId, removed: true };
  }
}
