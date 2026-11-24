import { VersionedNodeType, type INodeTypeBaseDescription } from 'n8n-workflow';
import { OmnichannelSupportV1 } from './v1/OmnichannelSupportV1';
import { OmnichannelSupportV2 } from './nodeV2';

export class OmnichannelSupport extends VersionedNodeType {
	constructor() {
		const description: INodeTypeBaseDescription = {
			displayName: 'Omnichannel Support',
			name: 'omnichannelSupport',
			icon: { light: 'file:omnichannel.svg', dark: 'file:omnichannel.svg' },
			group: ['transform'],
			description: 'Manage support messages, conversations and FAQs in Twenty CRM',
			defaultVersion: 2,
		};
		super(
			{ 1: new OmnichannelSupportV1(description), 2: new OmnichannelSupportV2(description) },
			description,
		);
	}
}
