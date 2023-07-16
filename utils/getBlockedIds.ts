import { Blocks, Mutes, User } from '../db'

export default async function getBlockedIds(userId: string): Promise<string[]> {
  try {
    const blocks = Blocks.findAll({
      where: {
        blockerId: userId
      }
    });
    const mutes = Mutes.findAll({
      where: {
        muterId: userId
      }
    });
    await Promise.all([blocks, mutes]);
    return (await blocks).concat(await mutes);
  } catch (error) {
    return []
  }
}
