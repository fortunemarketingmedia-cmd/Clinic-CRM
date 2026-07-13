import { whatsappRepository } from '../repositories/whatsapp.repository.js';

export const whatsappService = {
  listLogs() {
    return whatsappRepository.list();
  },

  queueMessage(input: { mobile: string; templateName: string; message: string; audience?: string }) {
    return whatsappRepository.create(input);
  },

  queueBroadcast(input: { audience: 'LEADS' | 'PATIENTS' | 'ALL'; templateName: string; message: string }) {
    return whatsappRepository.broadcast(input);
  },
};
