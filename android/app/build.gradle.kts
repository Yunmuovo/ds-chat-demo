plugins {
    id("com.android.application")
}

android {
    namespace = "com.yunmuovo.dschat"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.yunmuovo.dschat"
        minSdk = 24
        targetSdk = 34
        versionCode = 7
        versionName = "1.6"
    }

    // 固定签名：密钥由 CI 首次构建时生成并提交，保证后续版本可以覆盖安装
    signingConfigs {
        if (file("keystore.jks").exists()) {
            create("stable") {
                storeFile = file("keystore.jks")
                storePassword = "dschat2024"
                keyAlias = "dschat"
                keyPassword = "dschat2024"
            }
        }
    }

    buildTypes {
        debug {
            signingConfigs.findByName("stable")?.let { signingConfig = it }
        }
        release {
            isMinifyEnabled = false
            signingConfigs.findByName("stable")?.let { signingConfig = it }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
