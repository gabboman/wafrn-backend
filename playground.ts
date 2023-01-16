import { signedGetPetition } from "./routes/activitypub";
import { User } from "./models";

User.findOne().then(async (usr: any) => {
    try {
        const response = await signedGetPetition(usr, 'https://stop.voring.me/users/8vr46kdj6j')
        console.log(response)
    } catch (error){
        console.log(error)
    }

})