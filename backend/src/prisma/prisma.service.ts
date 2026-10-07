import { Injectable, OnModuleInit } from '@nestjs/common';
import { db } from './db.js';

@Injectable()
export class PrismaService implements OnModuleInit {
  public readonly client = db;

  async onModuleInit() {
    // Prisma client initialized
  }
}
