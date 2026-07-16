import keytar from 'keytar';
keytar.findCredentials('nyxora-cli').then(creds => console.log(creds.filter(c => c.account.includes('telegram'))));
