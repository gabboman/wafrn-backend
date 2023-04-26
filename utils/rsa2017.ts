import * as crypto from "node:crypto";
import jsonld from "jsonld";
import axios from "axios";
import { environment } from "../environment";

//import { httpAgent, httpsAgent } from "@/misc/fetch.js";

// RsaSignature2017 based from https://github.com/transmute-industries/RsaSignature2017

export class LdSignature {
  constructor() {}

	public async signRsaSignature2017(
		data: any,
		privateKey: string,
		creator: string,
		domain?: string,
		created?: Date,
	): Promise<any> {
		const options = {
			type: "RsaSignature2017",
			creator,
			domain,
			nonce: crypto.randomBytes(16).toString("hex"),
			created: (created || new Date()).toISOString(),
		} as {
			type: string;
			creator: string;
			domain?: string;
			nonce: string;
			created: string;
		};

		if (!domain) {
			options.domain = undefined;
		}

		let toBeSigned = await this.createVerifyData(data, options);
		const signer = crypto.createSign("sha256");
		signer.update(toBeSigned);
		signer.end();

		const signature = signer.sign(privateKey);

		return {
			...data,
			signature: {
				...options,
				signatureValue: signature.toString("base64"),
			},
		};
	}

	public async verifyRsaSignature2017(
		data: any,
		publicKey: string,
	): Promise<boolean> {
		let toBeSigned = await this.createVerifyData(data, data.signature);
		const verifier = crypto.createVerify("sha256");
		verifier.update(toBeSigned);
		return verifier.verify(publicKey, data.signature.signatureValue, "base64");
	}

	public async createVerifyData(data: any, options: any) {
		let res = '';
		try {
			const transformedOptions = {
				...options,
				"@context": `${environment.frontendUrl}/contexts/identity-v1.jsonld`,
				//"@context": 'http://cache.wafrn.net/?media=https://dev.wafrn.net/contexts/identity-v1.jsonld'
				//"@context": "https://w3id.org/identity/v1",
			};
			transformedOptions["type"] = undefined;
			transformedOptions["id"] = undefined;
			transformedOptions["signatureValue"] = undefined;
			//const canonizedOptions = await this.normalize(transformedOptions);
			const canonizedOptions = JSON.stringify(transformedOptions)
			const optionsHash = this.sha256(canonizedOptions);
			const transformedData = { ...data };
			transformedData["signature"] = undefined;
			const cannonidedData = await this.normalize(transformedData);
			const documentHash = this.sha256(cannonidedData);
			const verifyData = `${optionsHash}${documentHash}`;
			res =  verifyData;
		} catch (error) {
			console.log(error)
		}

		return res;
		
	}

	public async normalize(data: any) {
		const customLoader = this.getLoader();
		return await jsonld.normalize(data);
	}

	private getLoader() {
		return async (url: string): Promise<any> => {
      const urlObject = new URL(url);
			if (!url.match("^https?://")) throw new Error(`Invalid URL ${url}`);


			const document = await axios.get(url, {headers: {
        'Content-Type': 'application/activity+json',
        Accept: 'application/activity+json',
        Host: urlObject.host,
      }});
			return {
				contextUrl: null,
				document: document,
				documentUrl: url,
			};
		};
	}

	public sha256(data: string): string {
		const hash = crypto.createHash("sha256");
		hash.update(data);
		return hash.digest("hex");
	}
}
