import {Application} from 'express';
import {Op} from 'sequelize';
import {
  Post,
  PostMentionsUserRelation,
  PostReport,
  PostView,
  Tag,
  User,
} from '../models';
import authenticateToken from '../utils/authenticateToken';
import checkCaptcha from '../utils/checkCaptcha';
import getIp from '../utils/getIP';
import getPostBaseQuery from '../utils/getPostBaseQuery';
import sequelize from '../db';

export default function postsRoutes(app: Application) {
  app.post('/postDetails', async (req: any, res) => {
    let success = false;
    try {
      if (req.body && req.body.id) {
        const post = await Post.findOne({
          where: {
            id: req.body.id,
          },
        });
        if (post) {
          const totalReblogs = await post.getDescendents();
          res.send({reblogs: totalReblogs.length});
          PostView.create({
            postId: req.body.id,
          });
          success = true;
        }
      }
    } catch (error) {
      console.log(error);
    }
    if (!success) {
      res.send({
        success: false,
      });
    }
  });

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

  app.post('/blog', async (req: any, res) => {
    let success = false;
    if (req.body && req.body.id) {
      const blog = await User.findOne({
        where: {
          url: sequelize.where(
              sequelize.fn('LOWER', sequelize.col('url')),
              'LIKE',
              req.body.id.toLowerCase(),
          ),
        },
      });
      const blogId = blog?.id;
      if (blogId) {
        const postsByBlog = await Post.findAll({
          where: {
            userId: blogId,
            // date the user has started scrolling
            createdAt: {
              [Op.lt]: req.body?.startScroll ?
                new Date().setTime(req.body.startScroll) :
                new Date(),
            },
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
        const content = req.body.content ? req.body.content.trim() : '';
        const post = await Post.create({
          content: content,
          NSFW: req.body.nsfw === 'true',
          userId: posterId,
        });

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

        if (req.body.parent) {
          post.setParent(req.body.parent);
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
          });

          const newTagPromises: Array<Promise<any>> = [];
          if (existingTags) {
            existingTags.forEach((existingTag: any) => {
              existingTag.addPost(post);
              tagList.splice(tagList.indexOf(existingTag.tagName), 1);
            });
          }

          tagList.forEach((newTag: string) => {
            newTagPromises.push(
                Tag.create({
                  tagName: newTag,
                }),
            );
          });

          const newTags = await Promise.all(newTagPromises);
          newTags.forEach((newTag) => {
            newTag.addPost(post);
          });
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
