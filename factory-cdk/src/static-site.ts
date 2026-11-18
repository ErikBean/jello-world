// A static website: a private S3 bucket served through CloudFront with origin
// access control, filled from a local folder on every deploy. Its data is
// deleted with the stack in dev and preview. Spike: the first app pattern for
// the shared construct package.
import { RemovalPolicy } from "aws-cdk-lib";
import { Distribution, ViewerProtocolPolicy } from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { FactoryStack } from "./factory-stack";

export interface StaticSiteProps {
  /** The folder whose files are published, such as "site" or "dist". */
  readonly source: string;
  /** The page served for "/". Defaults to index.html. */
  readonly indexDocument?: string;
}

export class StaticSite extends Construct {
  public readonly bucket: Bucket;
  public readonly distribution: Distribution;
  public readonly url: string;

  constructor(scope: FactoryStack, id: string, props: StaticSiteProps) {
    super(scope, id);
    const ephemeral = scope.stage.ephemeral;

    this.bucket = new Bucket(this, "Bucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: ephemeral ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      autoDeleteObjects: ephemeral,
    });

    this.distribution = new Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: props.indexDocument ?? "index.html",
    });

    new BucketDeployment(this, "Deploy", {
      sources: [Source.asset(props.source)],
      destinationBucket: this.bucket,
      distribution: this.distribution,
    });

    this.url = `https://${this.distribution.distributionDomainName}`;
    scope.addUrl(id, this.url);
  }
}
