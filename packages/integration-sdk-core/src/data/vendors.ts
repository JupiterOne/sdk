import { startCase } from 'lodash';

export type VendorData = {
  _type: string;
  name: string;
  displayName?: string;
  category?: string;
  description?: string;
  iconWebLink?: string;
  linkToISA?: string;
  linkToDPA?: string;
  linkToMSA?: string;
  linkToSLA?: string;
  privacyPolicy?: string;
  statusPage?: string;
  termsConditions?: string;
  webLink?: string;
  website?: string;
};

export const KNOWN_VENDORS: { [key: string]: VendorData } = {
  // A
  adobe: {
    _type: 'adobe',
    name: 'Adobe',
    displayName: 'Adobe',
    iconWebLink: 'https://www.svgrepo.com/download/197935/adobe.svg',
    privacyPolicy: 'https://www.adobe.com/privacy/policy.html',
  },
  amazon: {
    _type: 'amazon',
    name: 'Amazon.com',
    displayName: 'Amazon.com',
    iconWebLink: 'https://www.svgrepo.com/download/22029/amazon.svg',
    privacyPolicy:
      'https://www.amazon.com/gp/help/customer/display.html?nodeId=GX7NJQ4ZB8MHFRNJ',
  },
  aws: {
    _type: 'aws',
    name: 'Amazon Web Services',
    displayName: 'AWS',
    category: 'CSP',
    description: 'AWS provides cloud computing infrastructure and services.',
    iconWebLink:
      'https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg',
    linkToISA: 'https://aws.amazon.com/compliance/programs/',
    linkToDPA: 'https://d1.awsstatic.com/legal/aws-gdpr/AWS_GDPR_DPA.pdf',
    linkToMSA: 'https://aws.amazon.com/agreement/',
    linkToSLA: 'https://aws.amazon.com/legal/service-level-agreements/',
    privacyPolicy: 'https://aws.amazon.com/privacy/',
    statusPage: 'https://status.aws.amazon.com/',
    termsConditions: 'https://aws.amazon.com/service-terms/',
    webLink: 'https://aws.amazon.com/',
    website: 'https://aws.amazon.com/',
  },
  apple: {
    name: 'Apple',
    _type: 'apple',
    iconWebLink: 'https://www.svgrepo.com/download/69341/apple-logo.svg',
  },
  atlassian: {
    name: 'Atlassian',
    _type: 'atlassian',
    iconWebLink: 'https://worldvectorlogo.com/download/atlassian-1.svg',
  },

  // B
  bamboohr: {
    name: 'BambooHR',
    _type: 'bamboohr',
    iconWebLink: '',
  },

  // C
  carbonblack: {
    name: 'Carbon Black',
    _type: 'carbon_black',
    iconWebLink: '',
  },
  cisco: {
    name: 'Cisco',
    _type: 'cisco',
    iconWebLink: 'https://www.svgrepo.com/download/303323/cisco-2-logo.svg',
  },
  coderpad: {
    name: 'CoderPad',
    _type: 'coderpad',
    iconWebLink: '',
  },
  crowdstrike: {
    name: 'CrowdStrike',
    _type: 'crowdstrike',
    iconWebLink: '',
  },
  cultureamp: {
    name: 'Culture Amp',
    _type: 'culture_amp',
    iconWebLink: '',
  },

  // D
  dashlane: {
    name: 'Dashlane',
    _type: 'dashlane',
    iconWebLink: '',
  },
  digicert: {
    name: 'DigiCert',
    _type: 'digicert',
    iconWebLink: '',
  },
  docusign: {
    name: 'DocuSign',
    _type: 'docusign',
    iconWebLink: '',
  },
  dome9: {
    name: 'Dome9',
    _type: 'dome9',
    iconWebLink: '',
  },
  dropbox: {
    name: 'Dropbox',
    _type: 'dropbox',
    iconWebLink: '',
  },

  // E
  easecentral: {
    name: 'EaseCentral',
    _type: 'easecentral',
    iconWebLink: '',
  },

  // F
  floqast: {
    name: 'FloQast',
    _type: 'floqast',
    iconWebLink: '',
  },
  fireeye: {
    name: 'FireEye',
    _type: 'fireeye',
    iconWebLink: '',
  },

  // G - Google
  google: {
    name: 'Google',
    _type: 'google',
    iconWebLink: 'https://www.svgrepo.com/download/304493/google.svg',
  },
  gcp: {
    name: 'Google Cloud',
    _type: 'google_cloud',
    iconWebLink:
      'https://www.svgrepo.com/download/303651/google-cloud-logo.svg',
  },
  android: {
    name: 'Google Android',
    _type: 'google_android',
    iconWebLink: 'https://www.svgrepo.com/download/184140/android.svg',
  },

  // G - Other
  github: {
    name: 'GitHub',
    _type: 'github',
    iconWebLink:
      'https://www.svgrepo.com/download/303615/github-icon-1-logo.svg',
  },
  golinks: {
    name: 'GoLinks',
    _type: 'golinks',
    iconWebLink: '',
  },

  // H
  hubspot: {
    name: 'HubSpot',
    _type: 'hubspot',
    iconWebLink: 'https://worldvectorlogo.com/download/hubspot-1.svg',
  },
  hellosign: {
    name: 'HelloSign',
    _type: 'hellosign',
    iconWebLink: '',
  },
  hackerone: {
    name: 'HackerOne',
    _type: 'hackerone',
    iconWebLink: 'https://www.svgrepo.com/download/306172/hackerone.svg',
  },

  // I
  invision: {
    name: 'InVision',
    _type: 'invision',
    iconWebLink: 'https://www.svgrepo.com/download/303291/invision-logo.svg',
  },

  // J
  jamf: {
    name: 'Jamf',
    _type: 'jamf',
    iconWebLink: 'https://www.vectorlogo.zone/logos/jamf/jamf-icon.svg',
  },
  jupiterone: {
    name: 'JupiterOne',
    _type: 'jupiterone',
    iconWebLink:
      'https://raw.githubusercontent.com/JupiterOne/docs/master/assets/brand/jupiterone.svg',
    linkToDPA: 'https://psp.jptr.one/gdpr-dpa.html',
    linkToISA: 'https://jupiterone.com/trust-and-transparency/',
    privacyPolicy: 'https://jupiterone.com/privacy-policy/',
    termsConditions: 'https://jupiterone.com/terms/',
  },

  // L
  leavelogic: {
    name: 'LeaveLogic',
    _type: 'leavelogic',
    iconWebLink: '',
  },
  lifeomic: {
    name: 'LifeOmic',
    _type: 'lifeomic',
    iconWebLink: '',
  },
  logmein: {
    name: 'LogMeIn',
    _type: 'logmein',
    iconWebLink: '',
  },

  // M
  mcafee: {
    name: 'McAfee',
    _type: 'mcafee',
    iconWebLink: '',
  },
  markmonitor: {
    name: 'Mark Monitor',
    _type: 'mark_monitor',
    iconWebLink: '',
  },
  microsoft: {
    name: 'Microsoft',
    _type: 'microsoft',
    iconWebLink: '',
  },
  mimecast: {
    name: 'Mimecast',
    _type: 'mimecast',
    iconWebLink: '',
  },
  modeanalytics: {
    name: 'Mode Analytics',
    _type: 'mode_analytics',
    iconWebLink: '',
  },

  // N
  naviabenefits: {
    name: 'Navia Benefits Solutions',
    _type: 'navia_benefits',
    iconWebLink: '',
  },

  // P
  pagerduty: {
    name: 'PagerDuty',
    _type: 'pagerduty',
    iconWebLink: '',
  },
  paloalto: {
    name: 'Palo Alto Networks',
    _type: 'palo_alto_networks',
    iconWebLink: '',
  },
  paylocity: {
    name: 'Paylocity',
    _type: 'paylocity',
    iconWebLink: '',
  },
  pritunl: {
    name: 'Pritunl',
    _type: 'pritunl',
    iconWebLink: '',
  },

  // R
  ringcentral: {
    name: 'RingCentral',
    _type: 'ringcentral',
    iconWebLink: '',
  },

  // S
  smallimprovements: {
    name: 'Small Improvements',
    _type: 'small_improvements',
    iconWebLink: '',
  },
  snyk: {
    name: 'Snyk',
    _type: 'snyk',
    iconWebLink: '',
  },
  sumologic: {
    name: 'Sumo Logic',
    _type: 'sumologic',
    iconWebLink: '',
  },

  // T
  textmagic: {
    name: 'TextMagic',
    _type: 'textmagic',
    iconWebLink: '',
  },
  threatstack: {
    name: 'Threat Stack',
    _type: 'threat_stack',
    iconWebLink: '',
  },
  trendmicro: {
    name: 'Trend Micro',
    _type: 'trend_micro',
    iconWebLink: '',
  },

  // V
  vmware: {
    name: 'VMware',
    _type: 'vmware',
    iconWebLink: '',
  },

  // W
  wordpress: {
    name: 'WordPress',
    _type: 'wordpress',
    iconWebLink: '',
  },
  wpengine: {
    name: 'WP Engine',
    _type: 'wp_engine',
    iconWebLink: '',
  },
};

export const VENDOR_APPS: { [key: string]: VendorData } = {
  // Apple
  ios: KNOWN_VENDORS.apple,
  ipados: KNOWN_VENDORS.apple,
  macos: KNOWN_VENDORS.apple,
  tvos: KNOWN_VENDORS.apple,

  // Atlassian
  bitbucket: KNOWN_VENDORS.atlassian,
  jira: KNOWN_VENDORS.atlassian,
  statuspage: KNOWN_VENDORS.atlassian,

  // Cisco
  meraki: KNOWN_VENDORS.cisco,

  // LogMeIn
  gotomeeting: KNOWN_VENDORS.logmein,

  // Microsoft
  office365: KNOWN_VENDORS.microsoft,
  windows: KNOWN_VENDORS.microsoft,

  // Mimecast
  ataata: KNOWN_VENDORS.mimecast,

  // VMware
  airwatch: KNOWN_VENDORS.vmware,
};

export function getVendorFromAppName(appName: string): VendorData {
  for (const [key, val] of Object.entries(VENDOR_APPS)) {
    if (appName.toLowerCase().includes(key)) {
      if (!val.displayName) {
        val.displayName = val.name;
      }
      return val;
    }
  }

  for (const [key, val] of Object.entries(KNOWN_VENDORS)) {
    if (appName.toLowerCase().includes(key)) {
      if (!val.displayName) {
        val.displayName = val.name;
      }
      return val;
    }
  }

  return {
    name: startCase(appName),
    _type: appName.toLowerCase().replace(/\s/g, '_'),
    iconWebLink: '',
  };
}
