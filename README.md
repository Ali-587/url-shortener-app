# Serverless URL Shortener - Application Code

This repository holds the application layer of the URL shortener. It includes the backend logic (Node.js) that runs on AWS Lambda and the static frontend assets (HTML, CSS, JS) hosted on Amazon S3 and served via CloudFront.

## Prerequisites

Before this code can be deployed, the infrastructure must already be provisioned using the infrastructure repository. 

To allow GitHub Actions to deploy the application, you need to configure an IAM Role using OIDC authentication.

### Application IAM Policy
Create an IAM role that trusts the GitHub OIDC provider and attach the following policy. Replace `<REGION>`, `<ACCOUNT_ID>`, and the frontend bucket names with your actual deployed values.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "UpdateLambdaCode",
            "Effect": "Allow",
            "Action": [
                "lambda:UpdateFunctionCode",
                "lambda:GetFunction",
                "lambda:GetFunctionConfiguration",
                "lambda:UpdateFunctionConfiguration"
            ],
            "Resource": "arn:aws:lambda:<REGION>:<ACCOUNT_ID>:function:*"
        },
        {
            "Sid": "UploadFrontendToS3",
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::<DEV_FRONTEND_BUCKET_NAME>",
                "arn:aws:s3:::<DEV_FRONTEND_BUCKET_NAME>/*",
                "arn:aws:s3:::<PROD_FRONTEND_BUCKET_NAME>",
                "arn:aws:s3:::<PROD_FRONTEND_BUCKET_NAME>/*"
            ]
        },
        {
            "Sid": "InvalidateCloudFront",
            "Effect": "Allow",
            "Action": [
                "cloudfront:CreateInvalidation"
            ],
            "Resource": "*"
        }
    ]
}
```

### Directory Structure

```.github/workflows/deploy-app.yaml```: The CI/CD pipeline that builds and deploys the application.

```backend/```: Contains the Node.js application.

```frontend/```: Contains the static website assets.


### Deployment Flow

The application deployment relies heavily on **GitHub Environments** to separate the dev and prod configurations. You must create these environments and add specific variables to them before the pipeline will work.

### Step 1: Create GitHub Environments
1. Go to your GitHub repository and click on **Settings**.
2. On the left sidebar, click **Environments**.
3. Click **New environment**, name it `dev`, and click Configure.
4. Go back to the Environments page and create a second environment named `prod`.

### Step 2: Add Environment Variables
You need to add the same variable names to *both* the `dev` and `prod` environments, but populate them with the environment-specific values from your Terraform outputs.

Inside both the `dev` and `prod` environments, scroll down to **Environment variables**, click **Add variable**, and add the following:
* `AWS_APP_ROLE_ARN`: The ARN of the AWS IAM role used for app deployment.
* `AWS_REGION`: Target AWS region (e.g., `us-east-1`).
* `LAMBDA_FUNCTION_NAME`: The name of the deployed Lambda function.
* `FRONTEND_BUCKET_NAME`: The exact name of the S3 bucket hosting the UI.
* `CLOUDFRONT_DISTRIBUTION_ID`: The ID of the CloudFront distribution.

When code is merged into the dev or prod branch, the pipeline performs the following steps:

1. Installs the backend dependencies using npm install.

2. Packages the backend directory into a deployment ZIP file.

3. Updates the existing AWS Lambda function with the new ZIP file.

4. Syncs the contents of the frontend directory to the target S3 bucket.

5. Triggers a CloudFront cache invalidation so users instantly see the new frontend changes.

