import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { CreateUserDto, UpdateUserDto } from './user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private repo: Repository<User>,
  ) {}

  /** Returns Okta-provisioned users + manually invited users (pre-provisioned by admin). */
  async findAll(): Promise<Omit<User, 'passwordHash'>[]> {
    return this.repo.find({
      where: [{ source: 'okta' }, { status: 'invited' }],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email })
      .getOne();
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.repo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 12) : '';
    // Usuarios creados por el admin se marcan como 'okta' — cuando inicien sesión vía Okta se sincronizarán
    const user = this.repo.create({ ...dto, passwordHash, status: 'invited', source: 'okta' });
    return this.repo.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.repo.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.repo.remove(user);
  }

  async updateLastLogin(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.repo.update(id, { lastLogin: now });
  }

  /**
   * Create or update a user record for an Okta-authenticated user.
   * Called on every successful Okta login to keep profile in sync.
   */
  async upsertFromOkta(profile: { sub: string; email: string; name: string }): Promise<User> {
    let user = await this.repo.findOne({ where: { email: profile.email } });
    if (!user) {
      user = this.repo.create({
        name: profile.name,
        email: profile.email,
        passwordHash: '',
        role: 'business-user',
        status: 'active',
        source: 'okta',
      });
    } else {
      // Keep profile in sync; promote legacy records to okta source
      user.name = profile.name;
      user.source = 'okta';
      if (user.status === 'inactive') user.status = 'active';
    }
    return this.repo.save(user);
  }

  /** Load user with the normally-hidden totpSecret field selected. */
  async findWithTotp(id: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.totpSecret')
      .where('u.id = :id', { id })
      .getOne();
  }
}
