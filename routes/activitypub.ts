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
                            href: environment.frontendUrl + '/blog/' + user.url
                          },
                          {
                            rel: "http://ostatus.org/schema/1.0/subscribe",
                            template: environment.frontendUrl + "/authorize_interaction?uri={uri}"
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
}



function return404(res: any) {
    res.sendStatus(404);
}

