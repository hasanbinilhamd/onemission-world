import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { donationService, DonationError } from '@/lib/donate/service';

function buildDonationErrorResponse(error, fallbackCode) {
  const normalizedError = error instanceof DonationError
    ? error
    : new DonationError({
        message: 'Something went wrong. Please try again later.',
        statusCode: 500,
        code: fallbackCode,
      });

  return NextResponse.json(
    { error: normalizedError.message, code: normalizedError.code },
    { status: normalizedError.statusCode || 500 },
  );
}

async function readRequestBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function GET(request) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'settings', 'view');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const campaignId = request.nextUrl?.searchParams?.get('campaignId') || '';
      const response = campaignId
        ? await donationService.getAdminCampaignDetail(campaignId)
        : await donationService.getAdminCampaigns();
      return NextResponse.json(response);
    } catch (error) {
      return buildDonationErrorResponse(error, 'DONATION_ADMIN_FETCH_FAILED');
    }
  });
}

export async function PUT(request) {
  return withDevTiming(request, async () => {
    let authContext;

    try {
      authContext = await requireHqPermission(request, 'settings', 'manage_configuration');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const payload = await readRequestBody(request);
      const action = String(payload.action || '');

      if (action === 'createCampaign') {
        const response = await donationService.createCampaign({
          campaign: payload.campaign || {},
          user: authContext.user,
        });
        return NextResponse.json(response);
      }

      if (!payload.campaignId) {
        return buildDonationErrorResponse(
          new DonationError({
            message: 'campaignId is required.',
            statusCode: 400,
            code: 'DONATION_CAMPAIGN_ID_REQUIRED',
          }),
          'DONATION_CAMPAIGN_ID_REQUIRED',
        );
      }

      if (action === 'updateCampaign') {
        const response = await donationService.updateCampaign({
          campaignId: payload.campaignId,
          campaign: payload.campaign || {},
          user: authContext.user,
        });
        return NextResponse.json(response);
      }

      if (action === 'setStatus') {
        const response = await donationService.setCampaignStatus({
          campaignId: payload.campaignId,
          status: payload.status,
          user: authContext.user,
        });
        return NextResponse.json(response);
      }

      if (action === 'replaceUpdates') {
        const response = await donationService.replaceCampaignUpdates({
          campaignId: payload.campaignId,
          updates: Array.isArray(payload.updates) ? payload.updates : [],
          user: authContext.user,
        });
        return NextResponse.json(response);
      }

      if (action === 'replaceDisbursements') {
        const response = await donationService.replaceCampaignDisbursements({
          campaignId: payload.campaignId,
          disbursements: Array.isArray(payload.disbursements) ? payload.disbursements : [],
          user: authContext.user,
        });
        return NextResponse.json(response);
      }

      if (action === 'replacePartners') {
        const response = await donationService.replaceCampaignPartners({
          campaignId: payload.campaignId,
          partners: Array.isArray(payload.partners) ? payload.partners : [],
          user: authContext.user,
        });
        return NextResponse.json(response);
      }

      return buildDonationErrorResponse(
        new DonationError({
          message: 'Unknown action. Supported: createCampaign, updateCampaign, setStatus, replaceUpdates, replaceDisbursements, replacePartners.',
          statusCode: 400,
          code: 'DONATION_ACTION_UNKNOWN',
        }),
        'DONATION_ACTION_UNKNOWN',
      );
    } catch (error) {
      return buildDonationErrorResponse(error, 'DONATION_ADMIN_UPDATE_FAILED');
    }
  });
}
