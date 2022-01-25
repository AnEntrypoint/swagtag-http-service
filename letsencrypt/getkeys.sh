certbot -d *.$2$1 --manual --work-dir ./ --config-dir ./ --logs-dir ./ --preferred-challenges dns certonly --manual-auth-hook ./auth.sh
cp live/$2$1/fullchain.pem ../$2cert.pem
cp live/$2$1/privkey.pem ../$2key.pem

certbot -d $2$1 --manual --work-dir ./ --config-dir ./ --logs-dir ./ --preferred-challenges dns certonly --manual-auth-hook ./auth.sh
cp live/$2$1/fullchain.pem ../$2plaincert.pem
cp live/$2$1/privkey.pem ../$2plainkey.pem