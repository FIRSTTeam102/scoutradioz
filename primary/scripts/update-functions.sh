# UPLOAD CODE
aws lambda update-function-code --function-name ${fnc} --zip-file fileb://${zip} --profile myprofile
aws lambda publish-version --function-name ${fnc} --profile myprofile
# CHANGE ALIAS
if [ -z "${ver}" ]; then
  marker=$(aws lambda list-versions-by-function --function-name ${fnc} --profile myprofile | grep NextMarker | cut -d'"' -f 4)
  while [ "${marker}" != "" ]; do
    ver=$(aws lambda list-versions-by-function --marker "${marker}" --function-name ${fnc} --profile myprofile | grep '"Version":' | cut -d'"' -f 4 | grep -v LATEST | sort -nr | head -1)
    marker=$(aws lambda list-versions-by-function --marker "${marker}" --function-name ${fnc} --profile myprofile | grep NextMarker | cut -d'"' -f 4)
    sleep 1
  done
fi
echo "Assigning ${label} => version ${ver}"
aws lambda update-alias --region us-east-1 --function-name ${fnc} --function-version ${ver} --name ${label} --profile myprofile
