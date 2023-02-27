import { signedGetPetition } from "./routes/activitypub";
import { User } from "./models";
import { logger } from "./utils/logger";

User.findOne().then(async (usr: any) => {
    try {
        const response = await signedGetPetition(usr, 'https://stop.voring.me/users/8vr46kdj6j')
        logger.info(response)
    } catch (error){
        logger.info(error)
    }

})