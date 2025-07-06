import type { Route } from './+types/products.$barcode';

// 제품 타입 정의
interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  description: string;
  manufacturer: string;
}

// 테스트용 상품 데이터베이스
const products: Record<string, Product> = {
  '123456789': {
    id: '123456789',
    name: '테스트 상품 A',
    price: 15000,
    category: '전자제품',
    stock: 50,
    description: '바코드 테스트용 상품입니다.',
    manufacturer: '테스트 회사',
  },
  '987654321': {
    id: '987654321',
    name: '테스트 상품 B',
    price: 8500,
    category: '생활용품',
    stock: 30,
    description: '또 다른 테스트 상품입니다.',
    manufacturer: '샘플 제조사',
  },
  CODE39TEST: {
    id: 'CODE39TEST',
    name: 'CODE39 샘플 제품',
    price: 25000,
    category: '샘플',
    stock: 100,
    description: 'CODE39 바코드 테스트 전용 상품',
    manufacturer: '바코드 테스트',
  },
};

// GET /server/products/:barcode - 바코드로 제품 조회
export async function loader({ params }: Route.LoaderArgs) {
  const { barcode } = params;

  // 바코드 파라미터 검증
  if (!barcode || barcode.trim() === '') {
    return Response.json(
      {
        success: false,
        error: '바코드가 제공되지 않았습니다.',
      },
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }

  // 제품 조회
  const product = products[barcode];

  if (!product) {
    return Response.json(
      {
        success: false,
        error: '해당 바코드의 제품을 찾을 수 없습니다.',
        barcode,
        availableBarcodes: Object.keys(products),
      },
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }

  // 성공 응답
  return Response.json(
    {
      success: true,
      data: {
        ...product,
        scannedAt: new Date().toISOString(),
        formattedPrice: `${product.price.toLocaleString()}원`,
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
}

// POST /server/products/:barcode - 제품 정보 업데이트 (재고 등)
export async function action({ params, request }: Route.ActionArgs) {
  const { barcode } = params;

  if (!barcode || !products[barcode]) {
    return Response.json(
      {
        success: false,
        error: '제품을 찾을 수 없습니다.',
      },
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }

  try {
    const body = await request.json();
    const product = products[barcode];

    // 재고 차감 로직
    if (body.action === 'decrease_stock' && typeof body.quantity === 'number') {
      if (product.stock >= body.quantity) {
        product.stock -= body.quantity;

        return Response.json(
          {
            success: true,
            message: `재고가 ${body.quantity}개 차감되었습니다.`,
            data: {
              ...product,
              formattedPrice: `${product.price.toLocaleString()}원`,
              updatedAt: new Date().toISOString(),
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          },
        );
      } else {
        return Response.json(
          {
            success: false,
            error: '재고가 부족합니다.',
            availableStock: product.stock,
            requestedQuantity: body.quantity,
          },
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          },
        );
      }
    }

    // 재고 증가 로직
    if (body.action === 'increase_stock' && typeof body.quantity === 'number') {
      product.stock += body.quantity;

      return Response.json(
        {
          success: true,
          message: `재고가 ${body.quantity}개 추가되었습니다.`,
          data: {
            ...product,
            formattedPrice: `${product.price.toLocaleString()}원`,
            updatedAt: new Date().toISOString(),
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      );
    }

    // 제품 정보 업데이트
    if (body.action === 'update_info') {
      const allowedFields = ['name', 'price', 'category', 'description', 'manufacturer'];
      let updated = false;

      allowedFields.forEach((field) => {
        if (body[field] !== undefined) {
          if (field === 'price') {
            const newPrice = Number(body[field]);
            if (!isNaN(newPrice) && newPrice >= 0) {
              (product as any)[field] = newPrice;
              updated = true;
            }
          } else if (typeof body[field] === 'string' && body[field].trim()) {
            (product as any)[field] = body[field].trim();
            updated = true;
          }
        }
      });

      if (updated) {
        return Response.json(
          {
            success: true,
            message: '제품 정보가 업데이트되었습니다.',
            data: {
              ...product,
              formattedPrice: `${product.price.toLocaleString()}원`,
              updatedAt: new Date().toISOString(),
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          },
        );
      }
    }

    return Response.json(
      {
        success: false,
        error: '지원하지 않는 액션입니다.',
        supportedActions: ['decrease_stock', 'increase_stock', 'update_info'],
      },
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  } catch (error) {
    console.error('API 처리 오류:', error);
    return Response.json(
      {
        success: false,
        error: '요청 처리 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }
}
