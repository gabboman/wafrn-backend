import { toHtml } from "@opera7133/mfmp/dist/mfm/toHtml";
import * as mfm from 'mfm-js'

import { activityPubObject } from "../../interfaces/fediverse/activityPubObject";
import { fediverseTag } from "../../interfaces/fediverse/tags";
import { getRemoteActor } from "./getRemoteActor";

async function getPostObject(apObject: any, userMakingPetition: any) {
    const remoteUser = await getRemoteActor(apObject.attributedTo, userMakingPetition)
    const medias = []
    const fediTags: fediverseTag[] = [
        ...new Set<fediverseTag>(
          apObject.tag
            ?.filter((elem: fediverseTag) => elem.type === 'Hashtag')
            .map((elem: fediverseTag) => {
              return { href: elem.href, type: elem.type, name: elem.name }
            })
        )
      ]
      let fediMentions: fediverseTag[] = apObject.tag?.filter((elem: fediverseTag) => elem.type === 'Mention')
      if (fediMentions == undefined) {
        fediMentions = apObject.to.map((elem: string) => {
          return { href: elem }
        })
      }
      const fediEmojis: any[] = apObject.tag?.filter((elem: fediverseTag) => elem.type === 'Emoji')
      let privacy = 10
      if (apObject.to.includes('https://www.w3.org/ns/activitystreams#Public')) {
        // post is PUBLIC
        privacy = 0
      }
      if (apObject.to[0].toString().indexOf('followers') !== -1) {
        privacy = 1;
      }

      let postTextContent =
        '' + apObject.source?.mediaType === 'text/x.misskeymarkdown'
          ? toHtml(mfm.parse(apObject.source.content))
          : apObject.content;
      

}

export { getPostObject }