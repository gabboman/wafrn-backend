import { PostMentionsUserRelation } from '../db'

export default async function getMentionsUser (userId: string) {
  try {
    const mentions = await PostMentionsUserRelation.findAll({
        where: {
            userId: userId
        }
    })
    return mentions.map((elem: any) => elem.postId ) as string[]
  } catch (error) {
    return []
  }
}