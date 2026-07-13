import type { Request, Response } from 'express';
import { userService } from '../services/user.service.js';
import { createUserSchema, updateUserSchema } from '../validations/user.validation.js';

export const userController = {
  async list(_req: Request, res: Response) {
    const users = await userService.listUsers();
    return res.json({ data: users });
  },

  async create(req: Request, res: Response) {
    const input = createUserSchema.parse(req.body);
    const user = await userService.createUser(input);
    return res.status(201).json({ data: user });
  },

  async update(req: Request, res: Response) {
    const input = updateUserSchema.parse(req.body);
    const user = await userService.updateUser(req.params.id, input);
    return res.json({ data: user });
  },

  async delete(req: Request, res: Response) {
    await userService.deleteUser(req.params.id);
    return res.status(204).send();
  },
};
