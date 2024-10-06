const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const archiver = require('archiver');

// Read command line arguments
const templateName = process.argv[2];
const destinationBucket = process.argv[3];
const awsRegion = process.argv[4];
if (!templateName || !destinationBucket || !awsRegion) {
  console.error('Error: All arguments must be provided.');
  console.error(
    'Usage: <script> <templateName> <destinationBucket> <awsRegion>'
  );
  process.exit(1);
}

const s3Client = new S3Client({ region: awsRegion });

// Run cdk synth first - it creates the Lambda code assets and CF template in cdk.out
async function main() {
  try {
    // Read the CloudFormation template
    const templatePath = path.join('cdk.out', `${templateName}`);
    console.log(`Reading template from ${templatePath}...`);
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

    // Identify all Lambda functions in the template
    console.log('Identifying Layers ...');
    const layers = identifyLayers(template);

    // Upload layer assets from cdk.out to new S3 location (they already zipped)
    for (let layer of layers) {
      const sourceAsset = path.join('cdk.out', `asset.${layer.codeAssetS3Key}`);
      console.log(`Uploading layer asset: ${layer.codeAssetS3Key} from ${sourceAsset}`);

      await uploadAsset(
        sourceAsset,
        destinationBucket,
        layer.codeAssetS3Key
      );
    }

    // Identify customcdk buckets in template
    console.log('Identifying CustomCDK Buckets...');
    const ccdkBuckets = identifyBuckets(template);

    // Zip and upload code assets from cdk.out to new S3 location
    for (let bucket of ccdkBuckets) {
      const assetHash = bucket.SourceKey.split('.')[0];
      const sourceDir = path.join('cdk.out', `asset.${assetHash}`);
      const outFile = `${path.join('cdk.out', `asset${assetHash}`)}.zip`;
      console.log(`Zipping ${sourceDir} and custom bucket asset: ${assetHash}, to zip file ${outFile}`);

      zipDirectory(sourceDir, outFile);
      console.log(`uploading asset ${outFile} to bucket ${destinationBucket} file ${assetHash}.zip`)
      await uploadAsset(
        outFile,
        destinationBucket,
        `${assetHash}.zip`
      );
    }

    // Identify all Lambda functions in the template
    console.log('Identifying Lambda functions...');
    const lambdas = identifyLambdas(template);

    // Zip and upload code assets from cdk.out to new S3 location
    for (let lambda of lambdas) {
      console.log(`Zipping and uploading lambda code asset: ${lambda.codeAssetS3Key}`);
      const zippedFilePath = await zipAsset(lambda.codeAssetS3Key);
      await uploadAsset(
        zippedFilePath,
        destinationBucket,
        lambda.codeAssetS3Key
      );
      fs.unlinkSync(zippedFilePath); // Clean up local zipped file
    }

    // Update template with new code asset paths
    console.log('Updating CloudFormation template with new code asset paths...');
    updateTemplateLambdaAssetPaths(template, lambdas, destinationBucket);
    updateTemplateLayerAssetPaths(template, layers, destinationBucket);
    updateTemplateCustCDKBucketAssetPaths(template, ccdkBuckets, destinationBucket);

    // Fix up customCDK bucket IAM policies
    console.log('Updating remaining cdk bucket references...');
    updateTemplateCDKPolicies(template, destinationBucket);
   

     // Remove remaining CDK vestiges
    delete template.Parameters.BootstrapVersion;
    delete template.Rules.CheckBootstrapVersion;

    // Adding parameters to CloudFormation template.
    //console.log('Adding parameters to CloudFormation template...');
    //parameterizeTemplate(template);

    // Add slack app manifest to the Outputs
    //console.log('Adding slack manifest to CloudFormation template...');
    //addSlackAppManifestOutputToTemplate(template);

    // Modify template description to differentiate from cdk deployments
    template.Description += ' (from S3 template)';

    // Copy converted template to new S3 location
    const convertedTemplateKey = `${templateName}`;
    console.log(
      `Uploading converted template to s3://${destinationBucket}/${convertedTemplateKey}`
    );
    await s3Client.send(
      new PutObjectCommand({
        Bucket: destinationBucket,
        Key: convertedTemplateKey,
        Body: JSON.stringify(template, null, 2)
      })
    );
  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
}

function identifyCDKPolicies(template) {
  let policies = [];
  for (let [key, value] of Object.entries(template.Resources)) { 
    if (value.Type === 'AWS::IAM::Policy') { // && value.Properties.PolicyDocument.Resource) {
      resources = value.Properties.PolicyDocument.Statement;
      console.log(`Found IAM Policy: Document resource ${key}`);
      //resources.forEach((resource) => {
      //    console.log(`Resource ${resource}`)
      //  }
     // )
      //policies.push({
      //  resourceName: key,
      //  SourceKey: value.Properties.SourceObjectKeys[0]
      //});
    }
  }
  return policies;
}


function identifyBuckets(template) {
  let buckets = [];
  for (let [key, value] of Object.entries(template.Resources)) { 
    if (value.Type === 'Custom::CDKBucketDeployment' && value.Properties?.SourceObjectKeys) {
      console.log(`Found cdk custom bucket: resource ${key}`);
      buckets.push({
        resourceName: key,
        SourceKey: value.Properties.SourceObjectKeys[0]
      });
    }
  }
  return buckets;
}

function identifyLambdas(template) {
  let lambdas = [];
  for (let [key, value] of Object.entries(template.Resources)) {
    if (value.Type === 'AWS::Lambda::Function' && value.Properties.Code?.S3Key) {
      console.log(`Found lambda function: resource ${key}`);
      lambdas.push({
        resourceName: key,
        codeAssetS3Key: value.Properties.Code.S3Key,
        roleResourceName: value.Properties.Role['Fn::GetAtt'][0]
      });
    }
  }
  return lambdas;
}

function identifyLayers(template) {
  let layers = [];
  for (let [key, value] of Object.entries(template.Resources)) {
    if (value.Type === 'AWS::Lambda::LayerVersion' && value.Properties.Content?.S3Key) {
      console.log(`Found layer: resource ${key} with s3key ${value.Properties.Content.S3Key}`);
      layers.push({
        resourceName: key,
        codeAssetS3Key: value.Properties.Content.S3Key
      });
    }
  }
  return layers;
}

async function zipAsset(S3Key) {
  const assetHash = S3Key.split('.')[0];
  const sourceDir = path.join('cdk.out', `asset.${assetHash}`);
  const outPath = `${path.join('cdk.out', assetHash)}.zip`;

  const zip = new JSZip();
  const files = fs.readdirSync(sourceDir);
  console.log(`Files: ${files}`);
  files.forEach((file) => {
    const filePath = path.join(sourceDir, file);
    const fileData = fs.readFileSync(filePath);
    zip.file(file, fileData);
  });

  await new Promise((resolve, reject) => {
    zip
      .generateNodeStream({ type: 'nodebuffer', streamFiles: true })
      .pipe(fs.createWriteStream(outPath))
      .on('finish', resolve) // Resolve the promise on finish
      .on('error', reject); // Reject the promise on error
  });

  return outPath;
}


function zipDirectory(sourceDir, outFile) {
  const archive = archiver('zip', { zlib: { level: 9 }});
  const stream = fs.createWriteStream(outFile);
  console.log(`Zipping folder ${sourceDir}...`)

  stream.on('close', function() { console.log('done') });
  archive.on('error', function(err) { console.log(`error ${err.message}`); throw err });
  
  archive.pipe(stream);
  
  archive.directory(sourceDir, '/').finalize();
}


async function uploadAsset(zippedFilePath, destinationBucket, originalKey) {
  const fileStream = fs.createReadStream(zippedFilePath);
  const destinationKey = `${path.basename(originalKey)}`;

  console.log(`Uploading zipped code asset to s3://${destinationBucket}/${destinationKey}`);

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: destinationBucket,
        Key: destinationKey,
        Body: fileStream
      })
    );
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

function updateTemplateLambdaAssetPaths(template, lambdas, destinationBucket) {
  for (let lambda of lambdas) {
    let lambdaResource = template.Resources[lambda.resourceName];
    lambdaResource.Properties.Code.S3Bucket = destinationBucket;
    lambdaResource.Properties.Code.S3Key = `${path.basename(lambda.codeAssetS3Key)}`; 
  }
}

function updateTemplateLayerAssetPaths(template, layers, destinationBucket) {
  for (let layer of layers) {
    let layerResource = template.Resources[layer.resourceName];
    layerResource.Properties.Content.S3Bucket = destinationBucket;
    layerResource.Properties.Content.S3Key = `${path.basename(layer.codeAssetS3Key)}`; 
  }
}

function updateTemplateCustCDKBucketAssetPaths(template, ccdkBuckets, destinationBucket) {
  for (let bucket of ccdkBuckets) {
    let bucketResource = template.Resources[bucket.resourceName];
    bucketResource.Properties.SourceBucketNames[0] = destinationBucket;
    bucketResource.Properties.SourceObjectKeys[0] = `${path.basename(bucket.SourceKey)}`;
  }
}

  // Helper function to recursively traverse and update the JSON
  function updateTemplateCDKPolicies(template, destinationBucket) {
    for (let key in template) {
      //console.log(`update buckets key=${key}`)
      if (typeof template[key] === 'object' && template[key] !== null) {
        if (template[key].hasOwnProperty('Fn::Sub') && template[key]['Fn::Sub'].includes("cdk-")) {
          console.log(`check for s3 bucket updating...${template[key]['Fn::Sub']}`);

          template[key]['Fn::Sub'] = destinationBucket;
        } else {
          updateTemplateCDKPolicies(template[key], destinationBucket);
        }
      }
    }
  }


main();
