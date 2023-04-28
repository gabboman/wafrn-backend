import { logger } from "../logger";
import { getPetitionSigned } from "./getPetitionSigned";
import { getRemoteActor } from "./getRemoteActor";

async function searchRemoteUser(searchTerm: string, user: any){
    const usernameAndDomain = searchTerm.split('@');
    const users: Array<any> = []
    if(searchTerm.startsWith('@') && searchTerm.length > 3 && usernameAndDomain.length === 3 ) {
      const userToSearch = searchTerm.substring(1)
      // fediverse users are like emails right? god I hope so
        const username = usernameAndDomain[1]
        const domain = usernameAndDomain[2]
        try {
          const remoteResponse = await getPetitionSigned(user, `https://${domain}/.well-known/webfinger/?resource=acct:${username}@${domain}`)
          const links = remoteResponse.data.links;
          for await (const responseLink of links) {
            if(responseLink.rel === 'self') {
              users.push( await getRemoteActor(responseLink.href, user))
            }
          };
  
        } catch (error) {
          logger.info('webfinger petition failed')
  
        }
        
      }
    return users;
  }

export {searchRemoteUser}