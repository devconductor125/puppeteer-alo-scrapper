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
        await page.setViewport({ width: 1024, height: 1024 })
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

async function pageScrolling(page: Page, currentScroll: number){

    const data = await page.content()
    const dom = new JSDOM(data)
    const document = dom.window.document

    await page.evaluate(() => {
        let scroll_location = document.body.scrollHeight
        return new Promise<void>((resolve, reject) => {
            const scrollInterval = setInterval(() => {
                const scroll_amount = 100
                window.scrollBy(0, -scroll_amount)
                scroll_location -= scroll_amount
                if (scroll_location <= 0) {
                    clearInterval(scrollInterval)
                    resolve()
                }
            }, 300)
        })
    });

}

async function scrapeAllPages(url: string, productType: ProductType) {
    let loading = true;
    const browser = await puppeteer.launch({ headless: false })
    const page = await browser.newPage()

    await page.goto(url, {
        waitUntil: "load",
        timeout: 0,
    })
    await page.setViewport({ width: 1024, height: 1024 })

    const data = await page.content()
    const dom = new JSDOM(data)
    const document = dom.window.document

    delayMs(2000);

    // Waiting for get total product number
    const allProuducts = document.querySelector('span.js-change-num')?.textContent;

    // Calculating start point
    let startProduct = Math.floor((Number(allProuducts)- 1)/12) * 12;
    console.log('Start at', startProduct);



    const newPage = await browser.newPage()
    await newPage.goto(url+"?start="+startProduct, {
        waitUntil: "load",
        timeout: 0,
    });

    await newPage.setViewport({ width: 1024, height: 1024 });

    const newData = await newPage.content()
    const newDom = new JSDOM(newData)
    const newDocument = newDom.window.document

    try {
        const header = newDocument.querySelector('.header-promo-row');
        console.log(header)
        if(header) {
            newDocument.querySelector('.header-promo-close-button')?.dispatchEvent(new Event('click'));
        }
    } catch(err) {
        console.log("error: ", err)
    }

    // scroll down 
    await newPage.evaluate(() => {
        let scroll_location = 0
        const scrollHeight = newDocument.body.scrollHeight
        return new Promise<void>((resolve, reject) => {
            const scrollInterval = setInterval(() => {
                const scroll_amount = 100
                window.scrollBy(0, scroll_amount)
                scroll_location += scroll_amount
                if (scroll_location >= scrollHeight - scroll_amount) {
                    clearInterval(scrollInterval)
                    resolve()
                }
            }, 200)
        })
    });

    delayMs(1000);

    //and then up
    await newPage.evaluate(() => {
        let scroll_location = newDocument.body.scrollHeight
        return new Promise<void>((resolve, reject) => {
            const scrollInterval = setInterval(() => {
                window.scrollTo(0, 0)
                clearInterval(scrollInterval)
                resolve()
            }, 300)
        })
    });


    while (loading) {
        console.log("Accessing next page...")

        // let scroll_location = document.body.scrollHeight
        // await pageScrolling(newPage, scroll_location)

        await newPage.evaluate(() => {
            let scroll_location = 0
            const scrollHeight = newDocument.body.scrollHeight
            return new Promise<void>((resolve, reject) => {
                const scrollInterval = setInterval(() => {
                    const scroll_amount = 100
                    window.scrollBy(0, scroll_amount)
                    scroll_location += scroll_amount
                    if (scroll_location >= 350) {
                        clearInterval(scrollInterval)
                        resolve()
                    }
                }, 300)
            })
        });

        await newPage.evaluate(() => {
            let scroll_location = newDocument.body.scrollHeight
            return new Promise<void>((resolve, reject) => {
                const scrollInterval = setInterval(() => {
                    const scroll_amount = 30
                    window.scrollBy(0, -scroll_amount)
                    scroll_location -= scroll_amount
                    if (scroll_location <= 100) {
                        clearInterval(scrollInterval)
                        resolve()
                    }
                }, 300)
            })
        });

        delayMs(3000);


        const currentPage = newPage.url().split("?")[1]?.split("=")[1];
        console.log(currentPage)
        if(Number(currentPage) <= 0) loading = false;
    }

    // await scrapingProducts(browser, newPage, productType);

    await newPage.close();
    await page.close();

    await browser.close()
}


async function delayMs(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

scrapeAllPages("https://www.pacsun.com/mens/shirts/", ProductType.SHIRT)

// scrapeAllPages("https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams", ProductType.SHIRT)

// scrapeAllPages("https://www.pacsun.com/mens/footwear/sneakers/", ProductType.SHOE)
