import express, { Application } from 'express'
import { environment } from '../environment'
import { Op } from 'sequelize';
import { Media, Post, User } from '../db';
import fs from 'fs';

export default function frontend(app: Application) {

    function getIndexSeo(title: string, description: string, image: string) {
        const sanitizedDescription = description.replaceAll('"', "'").substring(0, 500)
        const imgUrl = image.toLowerCase().startsWith('htt') ? environment.externalCacheurl + encodeURIComponent(image) : environment.mediaUrl + image
        let indexWithSeo = fs.readFileSync(`${environment.frontedLocation}/index.html`).toString()
        // index html must have a section with this html comment that we will edit out to put the seo there
        const commentToReplace = "<!-- REMOVE THIS IN EXPRESS FOR SEO -->"
        indexWithSeo = indexWithSeo.replace(commentToReplace, `<meta property="og:title" content="${title}">
        <meta name="twitter:title" content="${title}">
        
        <meta name="description" content="${sanitizedDescription}">
        <meta property="og:description" content="${sanitizedDescription}">
        <meta name="twitter:description" content="${sanitizedDescription}">
        
        <meta property="og:image" content="${imgUrl}">
        <meta name="twitter:image" content="${imgUrl}">`)

        return indexWithSeo
    }
    app.get('/post/:id', async function (req, res) {
        if (req.params?.id) {
            try {
                const post = await Post.findOne({
                    where: {
                      id: req.params.id,
                      privacy: { [Op.ne]: 10 }
                    },
                    attributes: ['content'],
                    include: [
                      {
                          model: User,
                          attributes: [
                              'url', 'avatar'
                          ]
                      }, {
                          model: Media,
                          attributes: ['NSFW', 'url', 'external']
                      }
                    ]
                  })
                  if(post) {
                      res.send(getIndexSeo(`Post by ${post.user.url}`, post.content, post.user.avatar ))
                  } else {
                      res.status(200).sendFile('/', { root: environment.frontedLocation })
                  }
            } catch (error) {
                res.status(200).sendFile('/', { root: environment.frontedLocation })
            }
        } else {
            res.status(200).sendFile('/', { root: environment.frontedLocation })
        }
    });
  
  // serve static angular files
  app.get('*.*', express.static(environment.frontedLocation, { maxAge: '1s' }))

  // serve default angular application
  app.all('*', function (req, res) {
    res.status(200).sendFile('/', { root: environment.frontedLocation })
  })
}
