import {Application} from 'express';
import {Op} from 'sequelize';
import {
  Post,
  PostMentionsUserRelation,
  PostReport,
  Tag,
  User,
} from '../models';
import authenticateToken from '../utils/authenticateToken';
import checkCaptcha from '../utils/checkCaptcha';
import getIp from '../utils/getIP';
import getPostBaseQuery from '../utils/getPostBaseQuery';
import sequelize from '../db';
import getStartScrollParam from '../utils/getStartScrollParam';

export default function postsRoutes(app: Application) {
  app.get('/singlePost/:id', async (req: any, res) => {
    let success = false;
    if (req.params && req.params.id) {
      const post = await Post.findOne({
        where: {
          id: req.params.id,
        },
        ...getPostBaseQuery(req),
      });
      res.send(post);
      success = true;
    }

    if (!success) {
      res.send({success: false});
    }
  });

  app.get('/blog', async (req: any, res) => {
    let success = false;
    const id = req.query.id;

    if (id) {
      const blog = await User.findOne({
        where: {
          url: sequelize.where(
              sequelize.fn('LOWER', sequelize.col('url')),
              'LIKE',
              id.toLowerCase(),
          ),
        },
      });
      const blogId = blog?.id;
      if (blogId) {
        const postsByBlog = await Post.findAll({
          where: {
            userId: blogId,
            // date the user has started scrolling
            createdAt: {[Op.lt]: getStartScrollParam(req)},
          },
          ...getPostBaseQuery(req),
        });
        success = true;
        res.send(postsByBlog);
      }
    }

    if (!success) {
      res.send({success: false});
    }
  });

  app.post('/createPost', authenticateToken, async (req: any, res) => {
    let success = false;
    const posterId = req.jwtData.userId;
    try {
      if (
        req.body &&
        req.body.captchaKey &&
        (await checkCaptcha(req.body.captchaKey, getIp(req)))
      ) {
        if (req.body.parent) {
          const parent = await Post.findOne({
            where: {
              id: req.body.parent,
            },
          });
          if (!parent) {
            success = false;
            res.send({success: false, message: 'non existent parent'});
            return false;
          }
        }
        const content = req.body.content ? req.body.content.trim() : '';
        const post = await Post.create({
          content: content,
          NSFW: req.body.nsfw === 'true',
          userId: posterId,
        });
        if (req.body.parent) {
          post.setParent(req.body.parent);
        }

        // detect media in posts using regexes

        // eslint-disable-next-line max-len
        const wafrnMediaRegex = /\[wafrnmediaid="[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}"\]/gm;

        // eslint-disable-next-line max-len
        const mentionRegex = /\[mentionuserid="[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}"\]/gm;

        // eslint-disable-next-line max-len
        const uuidRegex = /[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}/;

        const mediaInPost = req.body.content.match(wafrnMediaRegex);
        const mentionsInPost = req.body.content.match(mentionRegex);
        if (mediaInPost) {
          const mediaToAdd: String[] = [];
          mediaInPost.forEach((element: string) => {
            const mediaUUIDs = element.match(uuidRegex);
            if (mediaUUIDs) {
              const uuid = mediaUUIDs[0];
              if (mediaToAdd.indexOf(uuid) == -1) {
                mediaToAdd.push(uuid);
              }
            }
          });

          post.addMedias(mediaToAdd);
        }

        if (mentionsInPost) {
          const mentionsToAdd: String[] = [];
          mentionsInPost.forEach((elem: string) => {
            const mentionedUserUUID = elem.match(uuidRegex);

            if (
              mentionedUserUUID &&
              mentionedUserUUID[0] !== null &&
              mentionsToAdd.indexOf(mentionedUserUUID[0]) == -1
            ) {
              mentionsToAdd.push(mentionedUserUUID[0]);
            }
          });
          mentionsToAdd.forEach((mention) => {
            PostMentionsUserRelation.create({
              userId: mention,
              postId: post.id,
            });
          });
        }
        success = !req.body.tags;
        if (req.body.tags) {
          const tagListString = req.body.tags.toLowerCase();
          let tagList = tagListString.split(',');
          tagList = tagList.map((s: string) => s.trim());
          const existingTags = await Tag.findAll({
            where: {
              tagName: {
                [Op.in]: tagList,
              },
            },
            group: ['tagName'],
          });
          // eslint-disable-next-line max-len
          const existingTagsString = existingTags.map((tag: any) => tag.tagName);
          for (const tag of tagList) {
            const existingTagIndex = existingTagsString.indexOf(tag);
            if (existingTagIndex === -1 ) {
              // new tag, so we create the tag and then relationship
              const newTag = await Tag.create({
                tagName: tag,
              });
              // eslint-disable-next-line no-unused-vars
              const newTagWithPost = await newTag.addPost(post);
              await newTag.save();
            } else {
              // eslint-disable-next-line max-len
              // existing tag! so we just get the index and associate to the post
              await existingTags[existingTagIndex].addPost(post);
              await existingTags[existingTagIndex].save();
            }
          };
          success = true;
        }
        res.send(post);
      }
    } catch (error) {
      console.error(error);
    }
    if (!success) {
      res.statusCode = 400;
      res.send({success: false});
    }
  });

  app.post('/reportPost', authenticateToken, async (req: any, res) => {
    let success = false;
    let report;
    try {
      const posterId = req.jwtData.userId;
      if (
        req.body &&
        req.body.postId &&
        req.body.severity &&
        req.body.description
      ) {
        report = await PostReport.create({
          resolved: false,
          severity: req.body.severity,
          description: req.body.description,
          userId: posterId,
          postId: req.body.postId,
        });
        success = true;
        res.send(report);
      }
    } catch (error) {
      console.error(error);
    }
    if (!success) {
      res.send({
        success: false,
      });
    }
  });
}
