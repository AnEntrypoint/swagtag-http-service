certbot -d $1 --manual --work-dir ./ --config-dir ./ --logs-dir ./ --preferred-challenges dns certonly --manual-auth-hook ./auth.sh
cp live/$1/keys/fullchain.pem cert.pem
cp live/$1/keys/privkey.pem key.pem