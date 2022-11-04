import {Application} from 'express';
import {Post, PostMentionsUserRelation} from '../models';
import authenticateToken from '../utils/authenticateToken';

export default function deletePost(app: Application) {
  app.delete('/deletePost', authenticateToken, async (req: any, res) => {
    let success = false;
    try {
      const id = req.query.id;
      const posterId = req.jwtData.userId;
      if (id) {
        const postToDelete = await Post.findOne({
          where: {
            id: id,
            userId: posterId,
          },
        });
        const children = await postToDelete.getDescendents();
        postToDelete.removeMedias(await postToDelete.getMedias());
        postToDelete.removeTags(await postToDelete.getTags());
        await PostMentionsUserRelation.destroy({
          where: {
            postId: postToDelete.id,
          },
        });
        if (children.length === 0) {
          await postToDelete.destroy();
          success = true;
        } else {
          postToDelete.content = '<p>This post has been deleted</p>';
          success = true;
        }

        success = true;
      }
    } catch (error) {
      console.error(error);
      success = false;
    }

    res.send(success);
  });
}
