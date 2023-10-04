require("dotenv").config()
import puppeteer, { Browser, Page } from "puppeteer"
import { ScrapedProduct, ScrapedProductSite } from "./types/db"
import { DAO } from "./lib/dao"
import jsdom from "jsdom"
import { ProductType } from "./types/producttypes"
const { JSDOM } = jsdom

async function scrapeItem(item: Element, browser: Browser, productType: ProductType) {
    const productItem = item.className;
    if (productItem.trim() == "PlpTile") {
        const productLink = item.querySelector('a.image-wrapper')?.getAttribute("href")?.split("?")[0];
        const page = await browser.newPage();

        const productUrl = "https://www.aloyoga.com" + productLink;

        await page.goto(productUrl, {
            waitUntil: "load",
            timeout: 0,
        })
        await page.setViewport({ width: 1440, height: 1024 })
        delayMs(3000);

        const data = await page.content()
        const dom = new JSDOM(data)
        const document = dom.window.document

        try{
            await page.waitForSelector(".pdpBasicFallback")
        } catch (err) {console.log(err)}
        const productDetail = document.querySelector(".pdpBasicFallback");

        const image = document?.querySelector("img#ProductPhotoImg")?.getAttribute("src")?.split("?")[0];
        const title = document?.querySelector("h1#fallbackPdpTitle")?.textContent ?? "";
        const price = document?.querySelector("span#ProductPrice")?.getAttribute('content')?.replace(",", "") ?? '0';
        const description = productDetail?.querySelector(".description")?.querySelector('.description__row')?.querySelector('p')?.textContent ?? "";
        
        const product: ScrapedProduct = {
            title,
            url: productUrl ?? "",
            price: parseFloat(price),
            image: "https:" + image,
            description,
            site: ScrapedProductSite.ALOYOGA,
            product_type: productType
        }
        console.log("Product: ", product);
        await DAO.storeProduct(product)

        page.close();
    }
    else console.log("This is not product item");
}

async function scrapingProducts(browser: Browser, page: Page, productType: ProductType) {
    const data = await page.content()
    const dom = new JSDOM(data)
    const document = dom.window.document

    const productList = document.querySelector(".product-cards");
    if (!productList) throw new Error("No items found")
    const items = productList?.children

    for (let item of items) {
        await scrapeItem(item, browser, productType)
    }
}

async function pageScrolling(page: Page): Promise<boolean> {
    await page.evaluate(() => {
        let scroll_location = 0
        const scrollHeight = document.body.scrollHeight
        return new Promise<void>((resolve, reject) => {
            const scrollInterval = setInterval(() => {
                const scroll_amount = 200
                window.scrollBy(0, scroll_amount)
                scroll_location += scroll_amount
                if (scroll_location >= scrollHeight - scroll_amount) {
                    clearInterval(scrollInterval)
                    resolve()
                }
            }, 250)
        })
    });

    const data = await page.content()
    const dom = new JSDOM(data)
    const document = dom.window.document

    const loadMore = document.querySelector('.LoadingMoreSpinner');
    if (loadMore) {
        page.waitForSelector(".LoadingMoreSpinner");
        return true;
    }
    else return false;
}

async function scrapeAllPages(url: string, productType: ProductType) {
    let loading = true;
    const browser = await puppeteer.launch({ headless: 'new' })
    const page = await browser.newPage()

    await page.goto(url, {
        waitUntil: "load",
        timeout: 0,
    })
    await page.setViewport({ width: 1440, height: 1024 })

    while (loading) {
        console.log("Accessing next page...")
        loading = await pageScrolling(page)
    }

    await scrapingProducts(browser, page, productType);

    await page.close()
    await browser.close()
}


async function delayMs(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

scrapeAllPages("https://www.aloyoga.com/collections/tees-tanks", ProductType.SHIRT)