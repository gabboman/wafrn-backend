# WAFRN backend - Node.js REST API
Wafrn is an opensource social network that connects with the fediverse. The frontend (not included in this repo) is tumblr-inspired. The "official" wafrn server is [app.wafrn.net](https://app.wafrn.net) but you can host your own if you're unhappy with my moderation style or simply and more probable, you would like to host your own stuff.


## What will you need
Before trying to host your own wafrn, we advice you to please, very please, [join our matrix channel](https://matrix.to/#/#wafrn:matrix.org) to get support, questions to the team and all those stuffs. Wafrn is an alpha software. kinda. And you WILL find bugs. Either during the use or while trying to follow this manual. So yet again, [please join our matrix chatroom](https://matrix.to/#/#wafrn:matrix.org). We recomend the client element if you're new to this.
Ok let's get started, this is what you will need

- A few hours
- A linux machine with root access. This tutorial will asume debian or derivates
- We currently are using a strong free tier oracle vps with 24 gb of ram, but with our huge database we are using "only" 6gb of ram. I would advice for 4 or 8gb of ram.
- We will install mysql/mariadb, redis, apache and certbot. Feel free to skip what you know, but take a look to the apache config file, it's important

## First steps: update and install stuff
with the root user, do this command:

```bash
apt update && apt dist-upgrade
apt install curl mysql-server mysql apache2 certbot python3-certbot-apache build-essential redis ffmpeg webp graphicsmagick tmux
```
## Create a database
With the root user, we log in into the database with the command mysql. Then we create a db, and an user and a password:
```bash
mysql
```
```sql
CREATE DATABASE WAFRN;
CREATE USER 'wafrn'@'localhost' IDENTIFIED BY 'SAFE_PASSWORD';
GRANT ALL PRIVILEGES ON wafrn.* TO 'wafrn'@'localhost';
```
## Create a user for wafrn and prepare node for the user
You could install nodejs on the system level, but we do not recomend that. Instead, we advice for using nvm both in your machine if you ever do something, and in the server.
Create a new system user. In this case, we are going to call it wafrn
```bash
adduser wafrn
```
Now we will add the wafrn user to the apache group so we can use apache to serve the image files and the static frontend
```bash
usermod -aG www-data wafrn
```

**Restart apache** and **log in as the wafrn user**. Once you're there, time to install nvm.



```bash
curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash
source ~/.profile
nvm install node 18 #You could use 20 in theory.
```

Once you have installed nvm and node 18 in the wafrn user of your server, we will install the angular cli on the user, then clone the repositories
```bash
npm install -g @angular/cli
```
Now we will clone the repos that we need, and create the folder where the frontend will be served:
```bash
mkdir front
git clone https://github.com/gabboman/fediversemediacacher.git # the media cacher. its basically a proxy
git clone https://github.com/gabboman/wafrn.git #this is the frontend
git clone https://github.com/gabboman/wafrn-backend.git # the backend. 
```

Now we have to get into each of the folders and install the dependencies. Just **go into each of the folders and do**
```bash
npm install
```




```

STILL IN PROGRESS
```


> Written with [StackEdit](https://stackedit.io/).
