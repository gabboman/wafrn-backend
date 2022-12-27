import { Application } from 'express'
const environment = require('../environment')
import { User } from '../models'


// all the stuff related to activitypub goes here
export default function activityPubRoutes (app: Application) {

    //webfinger protocol
    app.get('/.well-known/webfinger/', async (req: any, res) => {
        if(req.query && req.query.resource) {
            const urlQueryResource: string = req.query.resource;
            if(urlQueryResource.startsWith('acct:') && urlQueryResource.endsWith(environment.instanceUrl)) {
                const userUrl = urlQueryResource.slice(5).slice(0,-(environment.instanceUrl.length + 1));
                const user = await User.findOne({
                    where: {
                        url: userUrl.toLowerCase()
                    }
                });
                if(!user){
                    return404(res);
                    return;
                }
                const response = {
                    subject: urlQueryResource,
                    aliases: [
                        environment.frontendUrl + '/blog/' + user.url
                    ],
                    links: [
                        {
                            rel: "self",
                            type: "application/activity+json",
                            href: environment.frontendUrl + '/fediverse/blog/' + user.url
                          },
                          {
                            rel: "http://ostatus.org/schema/1.0/subscribe",
                            template: environment.frontendUrl + "/fediverse/authorize_interaction?uri={uri}"
                          }
                    ]
                }
                res.send (
                    response
                );
            } else {
                return404(res);
                return;
            }
        }
        else {
            return404(res);
            return;
        }
    })

//Get blog for fediverse
app.get('/fediverse/blog/:url', async (req: any, res) => {
    if(req.params && req.params.url) {
        const url = req.params.url.toLowerCase();
        const user = await User.findOne({
            where: {
                url: url
            }
        });
        if(user) {
            const userForFediverse = {
                "@context": [
                    "https://www.w3.org/ns/activitystreams",
                    "https://w3id.org/security/v1"
                ],
                id: environment.frontendUrl + "/fediverse/" + user.url.toLowerCase(),
                type: "Person",
                following: environment.frontendUrl + "/fediverse/" + user.url.toLowerCase() + "/following",
                followers: environment.frontendUrl + "/fediverse/" + user.url.toLowerCase() + "/followers",
                featured: environment.frontendUrl + "/fediverse/" + user.url.toLowerCase() + "/featured",
                inbox: environment.frontendUrl + "/fediverse/" + user.url.toLowerCase() + "/inbox",
                outbox: environment.frontendUrl + "/fediverse/" + user.url.toLowerCase() + "/outbox",
                preferredUsername: user.url,
                name: user.url,
                summary: user.description,
                // url: "https://",
                manuallyApprovesFollowers: false,
                discoverable: true,
                published: user.createdAt,
            
                icon: {
                    "type": "Image",
                    "mediaType": "image/webp",
                    "url": environment.mediaUrl + user.avatar
                },
                image: {
                    "type": "Image",
                    "mediaType": "image/webp",
                    "url": environment.mediaUrl + user.avatar
                }
            };
            res.set({
                'content-type': 'application/activity+json'
            }).send(userForFediverse)
        } else {
            return404(res);
            return;
        }
    } else {
        return404(res);
        return;
    }
} );



app.get('/fediverse/:url/following', async (req: any, res) => { } );

app.get('/fediverse/:url/followers', async (req: any, res) => { } );

app.get('/fediverse/:url/featured', async (req: any, res) => { } );

app.get('/fediverse/:url/inbox', async (req: any, res) => { } );

app.get('/fediverse/:url/outbox', async (req: any, res) => { } );


}



function return404(res: any) {
    res.sendStatus(404);
}

